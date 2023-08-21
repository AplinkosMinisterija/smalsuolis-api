'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Method, Service } from 'moleculer-decorators';

import { generateToken, verifyToken } from '../utils';
import DbConnection from '../mixins/database.mixin';
import {
  COMMON_FIELDS,
  COMMON_DEFAULT_SCOPES,
  COMMON_SCOPES,
  FieldHookCallback,
  BaseModelInterface,
  EndpointType,
} from '../types';

export interface App extends BaseModelInterface {
  name: string;
  apiKey: string;
  type: string;
}

@Service({
  name: 'apps',

  mixins: [
    DbConnection({
      collection: 'apps',
      rest: false,
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

  hooks: {
    create: {
      auth: EndpointType.ADMIN,
    },
    update: {
      auth: EndpointType.ADMIN,
    },
    remove: {
      auth: EndpointType.ADMIN,
    },
    after: {
      create: [
        async function (ctx: Context, data: any) {
          return await ctx.call('apps.regenerateApiKey', { id: data.id });
        },
      ],
    },
  },
})
export default class AppsService extends moleculer.Service {
  @Action({
    params: {
      id: {
        type: 'number',
        convert: true,
      },
    },
    rest: 'POST /:id/generate',
    auth: EndpointType.ADMIN,
  })
  async regenerateApiKey(ctx: Context<{ id: number }>) {
    const app: App = await ctx.call('apps.resolve', { id: ctx.params.id });
    const apiKey = await generateToken(
      {
        id: app.id,
        type: app.type,
        name: app.name,
      },
      60 * 60 * 365 * 100
    );
    await ctx.call(
      'apps.update',
      {
        id: app.id,
        apiKey,
      },
      { meta: ctx.meta }
    );

    app.apiKey = apiKey;
    return app;
  }

  @Action({
    params: {
      key: 'string',
    },
    cache: {
      keys: ['key'],
    },
  })
  async verifyKey(ctx: Context<{ key: string }>) {
    const app = (await verifyToken(ctx.params.key)) as App;
    if (!app) return false;

    const appDb: App = await ctx.call('apps.resolve', { id: app.id });

    if (!appDb || appDb.type !== app.type) return false;

    return appDb;
  }
}
