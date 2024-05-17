'use strict';

import moleculer, { Context } from 'moleculer';
import { Method, Service } from 'moleculer-decorators';
import PostgisMixin, { intersectsQuery } from 'moleculer-postgis';
import DbConnection from '../mixins/database.mixin';
import {
  CommonFields,
  CommonPopulates,
  COMMON_DEFAULT_SCOPES,
  COMMON_FIELDS,
  COMMON_SCOPES,
  EndpointType,
  Table,
  UserAuthMeta,
  QueryObject,
} from '../types';
import { App } from './apps.service';
import { LKS_SRID, parseToJsonIfNeeded } from '../utils';
import { Subscription } from './subscriptions.service';

interface Fields extends CommonFields {
  app: number;
  name: string;
  type: string;
  geom: any;
  url: string;
  body: string;
  startAt: Date;
  endAt?: Date;
  isFullDay: boolean;
  externalId: string;
}

export type EventBodyJSON = {
  title: String;
  value: String;
};

export function toEventBodyMarkdown(data: EventBodyJSON[]) {
  return data.map((i) => `**${i.title}**: ${i.value || ''}`).join('\n\n');
}

interface Populates extends CommonPopulates {
  app: App;
}

export type Event<
  P extends keyof Populates = never,
  F extends keyof (Fields & Populates) = keyof Fields,
> = Table<Fields, Populates, P, F>;

// returns query with apps and geom filtering based on provided subscriptions.
export function applyEventsQueryBySubscriptions(query: QueryObject, subscriptions: Subscription[]) {
  if (!subscriptions?.length) {
    return query;
  }

  const subscriptionQuery = subscriptions.map((subscription) => ({
    ...(!!subscription.apps?.length && { app: { $in: subscription.apps } }),
    $raw: intersectsQuery('geom', subscription.geomWithBuffer, LKS_SRID),
  }));

  if (query?.$or) {
    query.$and = [query?.$or, { $or: subscriptionQuery }];
    delete query?.$or;
  } else {
    query.$or = subscriptionQuery;
  }

  return query;
}

@Service({
  name: 'events',
  mixins: [
    DbConnection({
      collection: 'events',
    }),
    PostgisMixin({ srid: LKS_SRID }),
  ],
  settings: {
    fields: {
      id: {
        type: 'number',
        columnType: 'integer',
        primaryKey: true,
        secure: true,
      },
      externalId: 'string',
      name: 'string|required',
      geom: {
        type: 'any',
        geom: true,
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
      ...COMMON_FIELDS,
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
    count: {
      auth: EndpointType.PUBLIC,
    },
    find: {
      rest: null,
    },
  },
  hooks: {
    before: {
      list: ['applyFilters'],
      find: ['applyFilters'],
      count: ['applyFilters'],
      get: ['applyFilters'],
      resolve: ['applyFilters'],
    },
  },
})
export default class EventsService extends moleculer.Service {
  @Method
  async applyFilters(ctx: Context<any, UserAuthMeta>) {
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
}
