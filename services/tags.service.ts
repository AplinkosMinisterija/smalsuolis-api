'use strict';

import moleculer from 'moleculer';
import { Service } from 'moleculer-decorators';
import DbConnection, { PopulateHandlerFn } from '../mixins/database.mixin';
import {
  CommonFields,
  CommonPopulates,
  COMMON_DEFAULT_SCOPES,
  COMMON_FIELDS,
  COMMON_SCOPES,
  EndpointType,
  Table,
} from '../types';
import { APP_TYPE } from './apps.service';

interface Fields extends CommonFields {
  name: string;
  appType: string;
}

interface Populates extends CommonPopulates {}

export type Tag<
  P extends keyof Populates = never,
  F extends keyof (Fields & Populates) = keyof Fields,
> = Table<Fields, Populates, P, F>;

@Service({
  name: 'tags',
  mixins: [
    DbConnection({
      collection: 'tags',
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
      name: 'string|required',

      appType: {
        type: 'string',
        required: true,
        enum: Object.values(APP_TYPE),
      },

      apps: {
        type: 'array',
        items: { type: 'object' },
        virtual: true,
        readonly: true,
        populate: {
          keyField: 'appType',
          handler: PopulateHandlerFn(`apps.populateByProp`),
          params: {
            queryKey: 'key',
            mappingMulti: true,
            sort: 'name',
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
      auth: EndpointType.PUBLIC,
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
})
export default class TagsService extends moleculer.Service {}
