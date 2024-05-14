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
import { parseToJsonIfNeeded } from '../utils';
import { applyEventsQueryBySubscriptions } from './events.service';
import { Subscription } from './subscriptions.service';

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
  return query || 'default';
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
      srid: WGS_SRID,
      geojson: {
        maxDecimalDigits: 5,
      },
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
  hooks: {
    before: {
      list: ['applyFilters'],
      find: ['applyFilters'],
      get: ['applyFilters'],
      resolve: ['applyFilters'],
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

    ctx.params.query = parseToJsonIfNeeded(ctx.params.query);
    ctx.meta.$responseType = 'application/x-protobuf';

    const supercluster = await this.getSupercluster(ctx);

    const tileEvents = supercluster.getTile(z, x, y);

    const layers: any = {};

    if (tileEvents) {
      layers.events = tileEvents;
    }

    return Buffer.from(vtpbf.fromGeojsonVt(layers, { extent: superclusterOpts.extent }));
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
        page?: number;
        pageSize?: number;
        populate?: string | string[];
        sort?: string | string[];
      },
      { $responseHeaders: any; $responseType: string }
    >,
  ) {
    const { cluster } = ctx.params;
    const page = ctx.params.page || 1;
    const pageSize = ctx.params.pageSize || 10;
    const { sort, populate } = ctx.params;
    const supercluster: Supercluster = await this.getSupercluster(ctx);

    if (!supercluster) throwNotFoundError('No items!');

    const ids = supercluster.getLeaves(cluster, Infinity).map((i) => i.properties.id);

    if (!ids?.length) {
      return {
        rows: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      };
    }

    return ctx.call('tiles.events.list', {
      query: {
        // knex support for `$in` is limited to 30K or smth
        $raw: `id IN ('${ids.join("', '")}')`,
      },
      populate,
      page,
      pageSize,
      sort,
    });
  }

  @Action({
    timeout: 0,
  })
  async getEventsFeatureCollection(ctx: Context<{ query: any }>) {
    const events: TilesEvent[] = await ctx.call('tiles.events.find', {
      query: ctx.params.query,
      populate: 'geom',
      fields: 'geom',
    });

    const features = events
      .map((i) => i.geom)
      .reduce((acc, item) => [...acc, ...item.features], []);

    return {
      type: 'FeatureCollection',
      features,
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

    delete this.superclustersPromises[hash];
  }

  @Method
  async applyFilters(ctx: Context<any>) {
    ctx.params.query = parseToJsonIfNeeded(ctx.params.query) || {};

    if (ctx.params.query.subscription) {
      const subscriptions: Subscription[] = await ctx.call('subscriptions.find', {
        query: { id: ctx.params.query.subscription },
        populate: 'geomWithBuffer',
      });
      ctx.params.query = applyEventsQueryBySubscriptions(ctx.params.query, subscriptions);
      delete ctx.params.query.subscription;
    }

    return ctx;
  }

  @Event()
  async 'cache.clean.tiles.events'() {
    await this.broker.cacher?.clean(`${this.fullName}.**`);
  }

  @Event()
  async 'tiles.events.renew'() {
    this.superclustersPromises = {};
    await this.renewSuperclusterIndex();
  }
}