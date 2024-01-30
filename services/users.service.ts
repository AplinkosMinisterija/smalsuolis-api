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
  isServer?: boolean;
}

const VISIBLE_TO_USER_SCOPE = 'tenant';
const NOT_ADMINS_SCOPE = 'notAdmins';

const AUTH_PROTECTED_SCOPES = [...COMMON_DEFAULT_SCOPES, VISIBLE_TO_USER_SCOPE, NOT_ADMINS_SCOPE];

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
        geom: true,
      },

      authUser: {
        type: 'number',
        columnType: 'integer',
        columnName: 'authUserId',
        populate: 'auth.users.get',
        async onRemove({ ctx, entity }: FieldHookCallback) {
          await ctx.call('auth.users.remove', { id: entity.authUserId }, { meta: ctx?.meta });
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
    rest: 'PATCH /me',
    auth: EndpointType.USER,
    params: {
      firstName: 'string',
      lastName: 'string',
      phone: 'string|optional',
      password: 'string|optional',
      oldPassword: 'string|optional',
    },
  })
  async patchMe(
    ctx: Context<
      {
        firstName: string;
        lastName: string;
        phone?: string;
        password?: string;
        oldPassword?: string;
      },
      UserAuthMeta
    >,
  ) {
    const { firstName, lastName, phone, password, oldPassword } = ctx.params;

    const user = await ctx.call('users.update', {
      id: ctx.meta.user.id,
      firstName,
      lastName,
      phone,
    });

    if (password && oldPassword) {
      await ctx.call('auth.users.update', {
        id: ctx.meta.user.authUser,
        firstName,
        lastName,
        phone,
        password,
        oldPassword,
      });
    }

    return user;
  }

  @Action({
    rest: 'POST /',
    auth: EndpointType.PUBLIC,
    params: {
      firstName: 'string',
      lastName: 'string',
      phone: 'string|optional',
      email: 'string',
      throwErrors: {
        type: 'boolean',
        optional: true,
        default: true,
      },
    },
  })
  async invite(
    ctx: Context<
      {
        firstName: string;
        lastName: string;
        phone?: string;
        email: string;
        throwErrors: boolean;
      },
      UserAuthMeta
    >,
  ) {
    const { throwErrors } = ctx.params;
    const authGroupId: number = Number(process.env.AUTH_GPOUP_ID);

    function getInviteData(data: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
    }) {
      const inviteData: any = {
        apps: [ctx.meta?.app?.id],
        throwErrors,
      };

      inviteData.firstName = data.firstName;
      inviteData.lastName = data.lastName;
      inviteData.email = data.email;
      inviteData.phone = data.phone;
      if (authGroupId) {
        inviteData.unassignExistingGroups = false;
        inviteData.groups = [{ id: authGroupId, role: 'USER' }];
      }

      return inviteData;
    }

    let authUser: any;
    const inviteData = getInviteData(ctx.params);

    authUser = await ctx.call('auth.users.create', inviteData);

    const user: User = await ctx.call('users.findOrCreate', {
      authUser,
      firstName: ctx.params.firstName,
      lastName: ctx.params.lastName,
      email: ctx.params.email,
      phone: ctx.params.phone,
    });

    if (authUser?.url) {
      return { ...user, url: authUser.url };
    }

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
    }>,
  ) {
    const { authUser, update, firstName, lastName, email, phone } = ctx.params;
    if (!authUser || !authUser.id) return;

    const scope = [...USERS_WITHOUT_AUTH_SCOPES];

    const authUserIsAdmin = ['SUPER_ADMIN', UserType.ADMIN].includes(authUser.type);

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
    >,
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
