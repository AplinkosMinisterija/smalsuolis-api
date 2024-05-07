'use strict';

import moleculer, { Context, GenericObject } from 'moleculer';
import { Action, Event, Method, Service } from 'moleculer-decorators';
import PostgisMixin from 'moleculer-postgis';
import DbConnection from '../mixins/database.mixin';
import { CommonFields, CommonPopulates, EndpointType, Table, throwNotFoundError } from '../types';
import Supercluster from 'supercluster';
// @ts-ignore
import vtpbf from 'vt-pbf';
import _ from 'lodash';
import md5 from 'md5';
import { LKS_SRID } from '../utils';

interface Fields extends CommonFields {
  name: string;
  body: string;
  url: string;
  appName: string;
  geom: any;
  startAt: Date;
  endAt?: Date;
  isFullDay: boolean;
  externalId: string;
}

interface Populates extends CommonPopulates {}

export type TilesEvent<
  P extends keyof Populates = never,
  F extends keyof (Fields & Populates) = keyof Fields,
> = Table<Fields, Populates, P, F>;

const superclusterOpts = {
  radius: 64,
  extent: 512,
  generateId: true,
  reduce: (acc: any, props: any) => acc,
};

const isLocalDevelopment = process.env.NODE_ENV === 'local';
const WGS_SRID = 4326;

function getSuperclusterHash(query: any = {}) {
  if (typeof query !== 'string') {
    query = JSON.stringify(query);
  }
  return md5(query || 'default');
}

@Service({
  name: 'tiles.events',
  mixins: [
    DbConnection({
      collection: 'events',
      createActions: {
        create: false,
        update: false,
        createMany: false,
        remove: false,
      },
    }),
    PostgisMixin({
      srid: LKS_SRID,
    }),
  ],
  settings: {
    fields: {
      id: {
        type: 'number',
        columnType: 'integer',
        primaryKey: true,
        secure: true,
      },
      name: 'string',
      geom: {
        type: 'any',
        geom: {
          properties: ['id'],
        },
      },
      app: {
        type: 'number',
        columnType: 'integer',
        columnName: 'appId',
        populate: 'apps.resolve',
      },
      url: 'string',
      body: 'string',
      startAt: {
        type: 'date',
        required: true,
        columnType: 'datetime',
      },
      endAt: {
        type: 'date',
        required: false,
        columnType: 'datetime',
      },
      isFullDay: {
        type: 'boolean',
        default: false,
      },
    },
  },
  actions: {
    list: {
      auth: EndpointType.PUBLIC,
    },
    get: {
      auth: EndpointType.PUBLIC,
    },
    find: {
      rest: null,
    },
    count: {
      rest: null,
    },
  },
})
export default class TilesEventsService extends moleculer.Service {
  @Action({
    rest: 'GET /:z/:x/:y',
    params: {
      x: 'number|convert|positive|integer',
      z: 'number|convert|positive|integer',
      y: 'number|convert|positive|integer',
      query: ['object|optional', 'string|optional'],
    },
    auth: EndpointType.PUBLIC,

    timeout: 0,
  })
  async getTile(
    ctx: Context<
      { x: number; y: number; z: number; query: string | GenericObject },
      { $responseHeaders: any; $responseType: string }
    >,
  ) {
    const { x, y, z } = ctx.params;

    if (typeof ctx.params.query === 'string') {
      try {
        ctx.params.query = JSON.parse(ctx.params.query);
      } catch (err) {}
    }
    ctx.meta.$responseType = 'application/x-protobuf';

    const supercluster = await this.getSupercluster(ctx);

    const tileEvents = supercluster.getTile(z, x, y);

    return Buffer.from(
      vtpbf.fromGeojsonVt(
        { events: tileEvents || { features: [] } },
        { extent: superclusterOpts.extent },
      ),
    );
  }

  @Action({
    rest: 'GET /cluster/:cluster/items',
    params: {
      cluster: 'number|convert|positive|integer',
      page: 'number|convert|positive|integer|optional',
      pageSize: 'number|convert|positive|integer|optional',
    },

    auth: EndpointType.PUBLIC,
  })
  async getTileItems(
    ctx: Context<
      {
        cluster: number;
        query: string | GenericObject;
        page: number;
        pageSize: number;
        populate: string | string[];
      },
      { $responseHeaders: any; $responseType: string }
    >,
  ) {
    const { cluster } = ctx.params;
    const page = ctx.params.page || 1;
    const pageSize = ctx.params.pageSize || 10;
    const supercluster: Supercluster = await this.getSupercluster(ctx);

    if (!supercluster) throwNotFoundError('No items!');

    const id = supercluster
      .getLeaves(cluster, pageSize, (page - 1) * pageSize)
      .map((i) => i.properties.id);

    const rows = await ctx.call('tiles.events.resolve', { id, populate: ctx.params.populate });
    const total = supercluster.getLeaves(cluster, Infinity).length;

    return {
      rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  @Action({
    params: {
      query: ['object|optional', 'string|optional'],
    },
    timeout: 0,
  })
  async getEventsFeatureCollection(ctx: Context<{ query: any }>) {
    const adapter = await this.getAdapter(ctx);
    const table = adapter.getTable();
    const knex = adapter.client;

    let query = ctx.params.query;

    if (typeof query === 'string') {
      try {
        query = JSON.parse(query);
      } catch (err) {}
    }

    const fields = ['id'];

    const eventsQuery = adapter
      .computeQuery(table, query)
      .select(...fields, knex.raw(`ST_Transform(ST_Centroid(geom), ${WGS_SRID}) as geom`));

    const res = await knex
      .select(knex.raw(`ST_AsGeoJSON(e)::json as feature`))

      .from(eventsQuery.as('e'));

    return {
      type: 'FeatureCollection',
      features: res.map((i: any) => i.feature),
    };
  }

  @Method
  async getSupercluster(ctx: Context<{ query: any }>) {
    const hash = getSuperclusterHash(ctx.params.query);

    if (!this.superclusters?.[hash]) {
      await this.renewSuperclusterIndex(ctx.params.query);
    }

    return this.superclusters[hash];
  }

  async started(): Promise<void> {
    this.superclusters = {};
    this.superclustersPromises = {};
    // This takes time
    if (!isLocalDevelopment) {
      await this.renewSuperclusterIndex();
    }
  }

  @Method
  async renewSuperclusterIndex(query: any = {}) {
    // TODO: apply to all superclusters (if exists)
    const hash = getSuperclusterHash(query);

    const supercluster = new Supercluster(superclusterOpts);

    // Singleton!
    if (this.superclustersPromises[hash]) {
      return this.superclustersPromises[hash];
    }

    this.superclustersPromises[hash] = this.actions.getEventsFeatureCollection({ query });
    const featureCollection: any = await this.superclustersPromises[hash];

    supercluster.load(featureCollection.features || []);
    this.superclusters[hash] = supercluster;
  }

  @Event()
  async 'cache.clean.tiles.events'() {
    await this.broker.cacher?.clean(`${this.fullName}.**`);
  }

  @Event()
  async 'tiles.events.renew'() {
    await this.renewSuperclusterIndex();
  }
}
