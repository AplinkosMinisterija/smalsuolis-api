'use strict';

import moleculer from 'moleculer';
import { Service } from 'moleculer-decorators';
import DbConnection from '../mixins/database.mixin';
import { CommonFields, COMMON_DEFAULT_SCOPES, COMMON_SCOPES, EndpointType } from '../types';

enum APP_TYPES {
  infostatyba = 'infostatyba',
  izuvinimas = 'izuvinimas',
  miskoKirtimai = 'miskoKirtimai',
  zemetvarkosPlanavimas = 'zemetvarkosPlanavimas',
}

export const APP_KEYS = {
  infostatybaNaujas: `${APP_TYPES.infostatyba}-naujas`,
  infostatybaRemontas: `${APP_TYPES.infostatyba}-remontas`,
  infostatybaGriovimas: `${APP_TYPES.infostatyba}-griovimas`,
  infostatybaPaskirtiesKeitimas: `${APP_TYPES.infostatyba}-paskirties-keitimas`,
  miskoKirtimai: APP_TYPES.miskoKirtimai,
  izuvinimas: APP_TYPES.izuvinimas,
  zemetvarkosPlanavimas: APP_TYPES.zemetvarkosPlanavimas,
};

export const APP_TYPE = {
  [APP_KEYS.infostatybaNaujas]: APP_TYPES.infostatyba,
  [APP_KEYS.infostatybaGriovimas]: APP_TYPES.infostatyba,
  [APP_KEYS.infostatybaRemontas]: APP_TYPES.infostatyba,
  [APP_KEYS.infostatybaPaskirtiesKeitimas]: APP_TYPES.infostatyba,
  [APP_KEYS.miskoKirtimai]: APP_TYPES.miskoKirtimai,
  [APP_KEYS.izuvinimas]: APP_TYPES.izuvinimas,
  [APP_KEYS.zemetvarkosPlanavimas]: APP_TYPES.zemetvarkosPlanavimas,
};

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
      key: {
        type: 'string',
        required: true,
        enum: Object.values(APP_KEYS),
      },
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
