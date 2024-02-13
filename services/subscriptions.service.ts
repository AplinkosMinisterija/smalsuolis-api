'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Method, Service } from 'moleculer-decorators';
import DbConnection from '../mixins/database.mixin';
import {
  COMMON_DEFAULT_SCOPES,
  COMMON_FIELDS,
  COMMON_SCOPES,
  CommonFields,
  CommonPopulates,
  EndpointType,
  FieldHookCallback,
  Frequency,
  Table,
  throwNoRightsError,
  UserAuthMeta,
} from '../types';
import { User } from './users.service';
import { App } from './apps.service';
import PostgisMixin from 'moleculer-postgis';
import Moleculer from 'moleculer';

interface Fields extends CommonFields {
  user: User['id'];
  apps: number[];
  geom: any;
  frequency: Frequency;
  active: boolean;
}

interface Populates extends CommonPopulates {
  apps: App[];
  user: User;
}

export type Subscription<
  P extends keyof Populates = never,
  F extends keyof (Fields & Populates) = keyof Fields,
> = Table<Fields, Populates, P, F>;

@Service({
  name: 'subscriptions',
  mixins: [DbConnection({ collection: 'subscriptions' }), PostgisMixin({ srid: 3346 })],
  settings: {
    fields: {
      id: {
        type: 'string',
        columnType: 'integer',
        primaryKey: true,
        secure: true,
      },
      user: {
        //subscriber
        type: 'number',
        required: true,
        columnType: 'integer',
        columnName: 'userId',
        immutable: true,
        readonly: true,
        populate: 'users.resolve',
        onCreate: async ({ ctx }: FieldHookCallback) => ctx.meta.user?.id,
        onUpdate: async ({ ctx, entity }: FieldHookCallback) => {
          if (entity.userId !== ctx.meta.user?.id) {
            return throwNoRightsError('Unauthorized');
          }
          return entity.userId;
        },
      },
      apps: {
        //apps subscribed to
        type: 'array',
        required: true,
        items: { type: 'number' },
        columnName: 'apps',
        validate: 'validateApps',
        populate(ctx: any, _values: any, items: Subscription[]) {
          return Promise.all(
            items.map((item: Subscription) => {
              if (!item.apps) return [];
              if (typeof item.apps === 'string') item.apps = JSON.parse(item.apps);
              return ctx.call('apps.resolve', { id: item.apps });
            }),
          );
        },
      },
      geom: {
        type: 'any',
        geom: true,
        required: true,
      },
      frequency: {
        // email sending frequency
        type: 'enum',
        values: Object.values(Frequency),
      },
      active: 'boolean', // is subscription active
      ...COMMON_FIELDS,
    },
    scopes: {
      user(query: any, ctx: Context<null, UserAuthMeta>, params: any) {
        query.user = ctx.meta.user?.id;
        return query;
      },
      ...COMMON_SCOPES,
    },
    defaultScopes: [...COMMON_DEFAULT_SCOPES, 'user'],
  },
  actions: {
    create: {
      auth: EndpointType.USER,
    },
    update: {
      auth: EndpointType.USER,
    },
    list: {
      auth: EndpointType.USER,
    },
    find: {
      auth: EndpointType.USER,
    },
    get: {
      auth: EndpointType.USER,
    },
    remove: {
      rest: null,
    },
    count: {
      rest: null,
    },
  },
})
export default class SubscriptionsService extends moleculer.Service {
  @Action({
    rest: 'POST /delete',
    auth: EndpointType.USER,
    params: {
      ids: {
        type: 'array',
        items: 'number|integer|positive',
      },
    },
  })
  async deleteMany(ctx: Context<{ ids: number[] }, UserAuthMeta>) {
    return this.removeEntities(ctx, {
      query: {
        id: { $in: ctx.params?.ids },
      },
    });
  }
  @Method
  async validateApps({ ctx, value, entity }: FieldHookCallback) {
    const apps: App[] = await ctx.call('apps.find', {
      query: {
        id: { $in: value },
      },
    });
    const ids = apps.map((app: App) => app.id);
    const diff = value.filter((id: number) => !ids.includes(id));
    if (apps.length !== value.length) {
      return `Invalid app ids [${diff.toString()}]`;
    }
    return true;
  }
}
