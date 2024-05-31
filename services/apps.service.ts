'use strict';

import moleculer from 'moleculer';
import { Service } from 'moleculer-decorators';
import DbConnection from '../mixins/database.mixin';
import {
  COMMON_FIELDS,
  COMMON_DEFAULT_SCOPES,
  COMMON_SCOPES,
  EndpointType,
  CommonFields,
} from '../types';

export enum APP_TYPES {
  infostatyba = 'infostatyba',
  izuvinimas = 'izuvinimas',
  miskoKirtimas = 'miskoKirtimas',
}

export interface App extends CommonFields {
  name: string;
  key: string;
  apiKey: string;
  description: string;
  icon: string;
}

@Service({
  name: 'apps',
  mixins: [
    DbConnection({
      collection: 'apps',
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
      key: 'string|required',
      name: 'string|required',
      description: 'string|required',
      icon: 'string|required',
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
    find: {
      auth: EndpointType.PUBLIC,
    },
    get: {
      auth: EndpointType.PUBLIC,
    },
    count: {
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
export default class AppsService extends moleculer.Service {}
