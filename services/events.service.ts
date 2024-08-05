'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Method, Service } from 'moleculer-decorators';
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
import { App, APP_TYPE } from './apps.service';
import { LKS_SRID, parseToJsonIfNeeded } from '../utils';
import { Subscription } from './subscriptions.service';
import { Tag } from './tags.service';
import { Knex } from 'knex';
import _ from 'lodash';

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
  tags: number[];
  tagsData: { id: Tag['id']; name: string; value: number }[];
}

export type EventBodyJSON = {
  title: String;
  value: String;
};

export function toEventBodyMarkdown(data: EventBodyJSON[]) {
  return data.map((i) => `**${i.title}**: ${i.value || '-'}`).join('\n\n');
}

interface Populates extends CommonPopulates {
  app: App;
  tags: Tag[];
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
      tags: {
        type: 'array',
        populate: {
          action: 'tags.resolve',
          params: {
            fields: ['id', 'name'],
          },
        },
        default: [],
      },
      tagsData: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: 'number',
            name: 'string',
            value: 'number',
          },
        },
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
    create: {
      rest: null,
    },
    update: {
      rest: null,
    },
    remove: {
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
  @Action({
    // rest: 'GET /',
    rest: {
      method: 'GET',
      path: '/',
      basePath: '/stats',
    },
    auth: EndpointType.PUBLIC,
  })
  async stats(ctx: Context<{ query: any }>) {
    const adapter = await this.getAdapter(ctx);
    const table = adapter.getTable();
    const knex: Knex = adapter.client;

    const query = await this.getComputedQuery(ctx);
    const eventsQuery = adapter.computeQuery(table, query);
    const tagsById: { [key: string]: Tag } = await ctx.call('tags.find', { mapping: 'id' });

    const appTypeCaseWhenClause = Object.keys(APP_TYPE).reduce((acc: string[], key: string) => {
      if (key && APP_TYPE[key]) {
        acc.push(`WHEN apps.key = '${key}' THEN '${APP_TYPE[key]}'`);
      }
      return acc;
    }, []);

    const appTypeCaseClause = `CASE ${appTypeCaseWhenClause.join(' ')} END AS app_type`;

    const eventsCountByAppType = await knex
      .select('ecat.appType')
      .count('ecat.id')
      .from(
        knex
          .select('events.id', knex.raw(appTypeCaseClause))
          .from(eventsQuery.as('events'))
          .leftJoin('apps', 'events.appId', 'apps.id')
          .as('ecat'),
      )
      .groupBy('ecat.appType');

    const eventsCountByTagId = await knex
      .select(knex.raw('jsonb_array_elements(events.tags)::numeric as tag_id'))
      .count('events.id')
      .from(eventsQuery.as('events'))
      .groupBy('tagId');

    const eventsCountByTagData = await knex
      .select(knex.raw('td.tag_id::numeric'), 'td.tagName')
      .sum(knex.raw('td.tag_value::numeric'))
      .from(
        knex
          .select(
            knex.raw(`jsonb_array_elements(events.tags_data)->>'id' as tag_id`),
            knex.raw(`jsonb_array_elements(events.tags_data)->>'name' as tag_name`),
            knex.raw(`jsonb_array_elements(events.tags_data)->>'value' as tag_value`),
          )
          .from(eventsQuery.as('events'))
          .whereNotNull('events.tagsData')
          .as('td'),
      )
      .groupBy(['tagId', 'tagName']);

    const stats: {
      count: number;

      byApp: {
        [key: App['key']]: {
          count: number;
          byTag?: { [key: Tag['name']]: { count: number; [key: string]: number } };
        };
      };
    } = {
      byApp: {},
      count: 0,
    };

    eventsCountByAppType?.forEach((item) => {
      const count = Number(item.count);
      const path = `byApp.${item.appType}.count`;
      const existingCount = _.get(stats, path, 0);
      _.set(stats, path, existingCount + count);
      stats.count += count;
    });

    eventsCountByTagId?.forEach((item) => {
      const tag = tagsById[item.tagId];
      const count = Number(item.count);

      const path = `byApp.${tag.appType}.byTag.${tag.name}.count`;
      const existingCount = _.get(stats, path, 0);
      _.set(stats, path, existingCount + count);
    });

    eventsCountByTagData?.forEach((item) => {
      const tag = tagsById[item.tagId];
      const count = Number(item.sum);

      const path = `byApp.${tag.appType}.byTag.${tag.name}.${item.tagName}`;
      const existingCount = _.get(stats, path, 0);
      _.set(stats, path, existingCount + count);
    });

    return stats;
  }

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

  @Method
  async getComputedQuery(ctx: Context<{ query: any }>) {
    let { params } = ctx;
    params = this.sanitizeParams(params);
    params = await this._applyScopes(params, ctx);
    params = this.paramsFieldNameConversion(params);

    return parseToJsonIfNeeded(params.query) || {};
  }
}
