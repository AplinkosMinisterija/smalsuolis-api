'use strict';

import moleculer, { Context } from 'moleculer';
import { Method, Service } from 'moleculer-decorators';
import PostgisMixin from 'moleculer-postgis';

import DbConnection from '../mixins/database.mixin';
import {
  COMMON_FIELDS,
  COMMON_DEFAULT_SCOPES,
  COMMON_SCOPES,
  FieldHookCallback,
  BaseModelInterface,
  EndpointType,
} from '../types';
import { App } from './apps.service';

import {
  geometryFilterFn,
  geometryFromText,
  geometryToGeom,
  GeomFeatureCollection,
} from '../modules/geometry';

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
