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

export interface App extends CommonFields {
  name: string;
  key: string;
  apiKey: string;
  description: string;
  icon: string;
}

export const APPS = {
  infostatyba: {
    name: 'Infostatyba',
    description: 'Statybos leidimai, Užbaigimo deklaracijos',
    icon: 'http://infostatyba.lt/wp-content/themes/infostatyba/img/favicon.ico',
  },
};

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
      apiKey: {
        type: 'string',
        hidden: true,
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
      auth: EndpointType.ADMIN,
    },
    update: {
      auth: EndpointType.ADMIN,
    },
    remove: {
      auth: EndpointType.ADMIN,
    },
  },
})
export default class AppsService extends moleculer.Service {}
