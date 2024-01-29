'use strict';

import { isEmpty } from 'lodash';
import moleculer, { Context } from 'moleculer';
import { Service } from 'moleculer-decorators';
import PostgisMixin from 'moleculer-postgis';

import DbConnection from '../mixins/database.mixin';
import {
  BaseModelInterface,
  COMMON_DEFAULT_SCOPES,
  COMMON_FIELDS,
  COMMON_SCOPES,
  EndpointType,
  FieldHookCallback,
  UserAuthMeta,
} from '../types';
import { getEventIdsByUserInfo } from '../utils/queries';
import { App } from './apps.service';

export interface Event extends BaseModelInterface {
  app: App;
  type: string;
  geom: any;
  url: string;
  body: string;
}

@Service({
  name: 'events',

  mixins: [
    DbConnection({
      collection: 'events',
    }),
    PostgisMixin({ srid: 3346 }),
  ],

  settings: {
    fields: {
      id: {
        type: 'number',
        columnType: 'integer',
        primaryKey: true,
        secure: true,
      },

      name: 'string|required',

      geom: {
        type: 'any',
        geom: true,
      },

      app: {
        type: 'number',
        columnType: 'integer',
        hidden: 'byDefault',
        columnName: 'appId',
        onCreate: ({ ctx }: FieldHookCallback) => ctx.meta.app?.id,
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
        required: true,
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
      async visibleToUser(query: any, ctx: Context<null, UserAuthMeta>) {
        const { user } = ctx?.meta;
        if (!user?.id) return query;

        const eventIds = await getEventIdsByUserInfo(user);

        if (!isEmpty(eventIds)) {
          return { ...query, id: { $in: eventIds.map((i: any) => i.id) } };
        }

        return query;
      },
    },

    defaultScopes: [...COMMON_DEFAULT_SCOPES],
  },

  actions: {
    create: {
      auth: EndpointType.APP,
    },
    update: {
      auth: EndpointType.APP,
    },
    remove: {
      auth: EndpointType.APP,
    },
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
export default class EventsService extends moleculer.Service {}
