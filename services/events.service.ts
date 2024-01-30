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
  UserAuthMeta,
} from '../types';
import { getEventIdsByUserInfo } from '../utils/queries';

export interface Event extends BaseModelInterface {
  id: number;
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

      externalId: 'string',
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
      async visibleToUser(query: any, ctx: Context<null, UserAuthMeta>) {
        const { user } = ctx?.meta;

        if (!user?.id || (isEmpty(user.geom) && isEmpty(user.apps))) return query;

        const eventIds = await getEventIdsByUserInfo(user);

        return { ...query, id: { $in: eventIds.map((i: any) => i.id) } };
      },
    },

    defaultScopes: [...COMMON_DEFAULT_SCOPES, 'visibleToUser'],
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
