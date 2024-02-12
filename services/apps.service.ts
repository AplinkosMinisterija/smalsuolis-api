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
    icon:
      '<svg\n' +
      '          xmlns="http://www.w3.org/2000/svg"\n' +
      '          width="24"\n' +
      '          height="24"\n' +
      '          viewBox="0 0 24 24"\n' +
      '          fill="none"\n' +
      '          stroke="currentColor"\n' +
      '          stroke-width="2"\n' +
      '          stroke-linecap="round"\n' +
      '          stroke-linejoin="round"\n' +
      '        >\n' +
      '          <path  d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>\n' +
      '          <polyline  points="9 22 9 12 15 12 15 22"></polyline>\n' +
      '        </svg>',
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
