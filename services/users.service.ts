'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Event, Service } from 'moleculer-decorators';

import DbConnection from '../mixins/database.mixin';
import {
  COMMON_FIELDS,
  COMMON_DEFAULT_SCOPES,
  COMMON_SCOPES,
  FieldHookCallback,
  BaseModelInterface,
  EndpointType,
  throwNotFoundError,
  UserAuthMeta,
} from '../types';
import PostgisMixin from 'moleculer-postgis';

export enum UserType {
  ADMIN = 'ADMIN',
  USER = 'USER',
}
export interface User extends BaseModelInterface {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  type: UserType;
  authUser: number;
  isExpert: boolean;
  expertSpecies: number[];
  isServer?: boolean;
}

const VISIBLE_TO_USER_SCOPE = 'tenant';
const NOT_ADMINS_SCOPE = 'notAdmins';

const AUTH_PROTECTED_SCOPES = [
  ...COMMON_DEFAULT_SCOPES,
  VISIBLE_TO_USER_SCOPE,
  NOT_ADMINS_SCOPE,
];

export const USERS_WITHOUT_AUTH_SCOPES = [`-${VISIBLE_TO_USER_SCOPE}`];
const USERS_WITHOUT_NOT_ADMINS_SCOPE = [`-${NOT_ADMINS_SCOPE}`];
export const USERS_DEFAULT_SCOPES = [
  ...USERS_WITHOUT_AUTH_SCOPES,
  ...USERS_WITHOUT_NOT_ADMINS_SCOPE,
];

@Service({
  name: 'users',

  mixins: [
    DbConnection({
      collection: 'users',
    }),

    PostgisMixin({ srid: 3346 }),
  ],

  settings: {
    fields: {
      id: {
        type: 'string',
        columnType: 'integer',
        primaryKey: true,
        secure: true,
      },

      firstName: 'string',

      lastName: 'string',

      email: 'string',

      phone: 'string',

      type: {
        type: 'string',
        enum: Object.values(UserType),
        default: UserType.USER,
      },

      geom: {
        type: 'any',
        raw: true,
        populate: {
          keyField: 'id',
          action: 'users.getGeometryJson',
        },
      },

      authUser: {
        type: 'number',
        columnType: 'integer',
        columnName: 'authUserId',
        populate: 'auth.users.get',
        async onRemove({ ctx, entity }: FieldHookCallback) {
          await ctx.call(
            'auth.users.remove',
            { id: entity.authUserId },
            { meta: ctx?.meta }
          );
        },
      },

      ...COMMON_FIELDS,
    },
  },

  scopes: {
    ...COMMON_SCOPES,
    notAdmins(query: any) {
      query.type = UserType.USER;
      return query;
    },

    defaultScopes: AUTH_PROTECTED_SCOPES,
  },

  actions: {
    create: {
      rest: null,
    },

    get: {
      auth: EndpointType.ADMIN,
    },

    list: {
      auth: EndpointType.ADMIN,
    },

    remove: {
      rest: null,
    },

    update: {
      rest: null,
    },

    count: {
      rest: null,
    },

    find: {
      rest: null,
    },
  },
})
export default class UsersService extends moleculer.Service {
  @Action({
    rest: 'POST /',
    params: {
      personalCode: 'any',
      firstName: 'string',
      lastName: 'string',
      email: 'string',
      phone: 'string',
    },
    types: [EndpointType.ADMIN],
  })
  async invite(
    ctx: Context<
      {
        personalCode: string;
        email: string;
      },
      UserAuthMeta
    >
  ) {
    const { personalCode, email } = ctx.params;
    const data: any = {
      personalCode,
      notify: [email],
    };

    let authGroupId;

    const authUser: any = await ctx.call('auth.users.invite', data);

    const user: User = await ctx.call('users.findOrCreate', {
      authUser: authUser,
      ...ctx.params,
    });

    return user;
  }

  @Action({
    rest: 'POST /:id/impersonate',
    params: {
      id: {
        type: 'number',
        convert: true,
      },
    },
  })
  async impersonate(ctx: Context<{ id: number }, UserAuthMeta>) {
    const { id } = ctx.params;

    const user: User = await ctx.call('users.resolve', { id });

    return ctx.call('auth.users.impersonate', { id: user.authUser });
  }

  @Action({
    params: {
      authUser: 'any',
    },
    cache: {
      keys: ['authUser.id'],
    },
  })
  async resolveByAuthUser(ctx: Context<{ authUser: any }>) {
    const user: User = await ctx.call('users.findOrCreate', {
      authUser: ctx.params.authUser,
    });

    return user;
  }

  @Action({
    params: {
      authUser: 'any',
      update: {
        type: 'boolean',
        default: false,
      },
      firstName: {
        type: 'string',
        optional: true,
      },
      lastName: {
        type: 'string',
        optional: true,
      },
      email: {
        type: 'string',
        optional: true,
      },
      phone: {
        type: 'string',
        optional: true,
      },
    },
  })
  async findOrCreate(
    ctx: Context<{
      authUser: any;
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      update?: boolean;
    }>
  ) {
    const { authUser, update, firstName, lastName, email, phone } = ctx.params;
    if (!authUser || !authUser.id) return;

    const scope = [...USERS_WITHOUT_AUTH_SCOPES];

    const authUserIsAdmin = ['SUPER_ADMIN', UserType.ADMIN].includes(
      authUser.type
    );

    if (authUserIsAdmin) {
      scope.push(...USERS_WITHOUT_NOT_ADMINS_SCOPE);
    }

    const user: User = await ctx.call('users.findOne', {
      query: {
        authUser: authUser.id,
      },
      scope,
    });

    if (!update && user && user.id) return user;

    const dataToSave = {
      firstName: firstName || authUser.firstName,
      lastName: lastName || authUser.lastName,
      type: authUserIsAdmin ? UserType.ADMIN : UserType.USER,
      email: email || authUser.email,
      phone: phone || authUser.phone,
    };

    if (user?.id) {
      return ctx.call('users.update', {
        id: user.id,
        ...dataToSave,
        scope,
      });
    }

    // let user to customize his phone and email
    if (user?.email) {
      delete dataToSave.email;
    }
    if (user?.phone) {
      delete dataToSave.phone;
    }

    return ctx.call('users.create', {
      authUser: authUser.id,
      ...dataToSave,
    });
  }

  @Action({
    rest: 'DELETE /:id',
    params: {
      id: {
        type: 'number',
        convert: true,
      },
    },
    types: [EndpointType.ADMIN],
  })
  async removeUser(ctx: Context<{ id: number }, UserAuthMeta>) {
    const { id } = ctx.params;
    const user = await ctx.call('users.get', { id });

    if (!user) {
      return throwNotFoundError('User not found.');
    }
    if (ctx.meta.user.type === UserType.ADMIN) {
      await ctx.call('tenantUsers.removeTenants', {
        userId: id,
      });
    }

    return ctx.call('users.remove', { id });
  }

  @Action({
    rest: 'PATCH /:id',
    params: {
      id: { type: 'number', convert: true },
      email: {
        type: 'string',
        optional: true,
      },
      phone: {
        type: 'string',
        optional: true,
      },
      tenantId: {
        type: 'number',
        optional: true,
      },
    },
  })
  async updateUser(
    ctx: Context<
      {
        id: number;
        email: string;
        phone: string;
      },
      UserAuthMeta
    >
  ) {
    const { id, email, phone } = ctx.params;

    const userToUpdate: User = await ctx.call('users.get', { id });

    if (!userToUpdate) {
      return throwNotFoundError('User not found.');
    }

    return ctx.call('users.update', {
      id,
      email,
      phone,
    });
  }

  @Event()
  async 'users.**'() {
    this.broker.emit('cache.clean.auth');
    this.broker.emit(`cache.clean.${this.fullName}`);
  }

  @Event()
  async 'cache.clean.users'() {
    await this.broker.cacher?.clean(`${this.fullName}.**`);
  }
}
