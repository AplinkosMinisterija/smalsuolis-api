'use strict';

import moleculer, { Context } from 'moleculer';
import { Event, Method, Service } from 'moleculer-decorators';
import {
  COMMON_DEFAULT_SCOPES,
  COMMON_SCOPES,
  CommonFields,
  CommonPopulates,
  EndpointType,
  Table,
} from '../types';
import _ from 'lodash';
import { LKS_SRID, parseToJsonIfNeeded } from '../utils';
import { applyEventsQueryBySubscriptions } from './events.service';
import { Subscription } from './subscriptions.service';
import config from '../knexfile';
import { TilesMixin } from '@aplinkosministerija/moleculer-accounts';
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

const isLocalDevelopment = process.env.NODE_ENV === 'local';

@Service({
  name: 'tiles.events',
  mixins: [
    TilesMixin({
      config,
      opts: {
        collection: 'events',
      },
      srid: LKS_SRID,
      layerName: 'events',
      maxClusteringZoomLevel: 12,
      preloadClustersOnStart: !isLocalDevelopment,
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
    scopes: {
      ...COMMON_SCOPES,
    },
    defaultScopes: [...COMMON_DEFAULT_SCOPES],
  },
  actions: {
    list: {
      auth: EndpointType.PUBLIC,
    },
    get: {
      auth: EndpointType.PUBLIC,
    },
    getTileItems: {
      auth: EndpointType.PUBLIC,
    },
    getTile: {
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
      getEventsFeatureCollection: ['applyFilters'],
      getTile: ['applyFilters'],
    },
  },
})
export default class TilesEventsService extends moleculer.Service {
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
  async 'integrations.sync.finished'() {
    this.superclustersPromises = {};
    await this.renewSuperclusterIndex();
  }
}
