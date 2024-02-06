'use strict';

import moleculer, { Context, RestSchema } from 'moleculer';
import { Action, Event, Method, Service } from 'moleculer-decorators';

import authMixin from 'biip-auth-nodejs/mixin';
import { User, USERS_DEFAULT_SCOPES, UserType } from './users.service';
import { EndpointType, throwNotFoundError, UserAuthMeta } from '../types';

@Service({
  name: 'auth',
  mixins: [
    authMixin(process.env.AUTH_API_KEY, {
      host: process.env.AUTH_HOST || '',
      appHost: process.env.APP_HOST || 'https://smalsuolis.biip.lt',
    }),
  ],
  actions: {
    'users.resolveToken': {
      cache: {
        keys: ['#authToken'],
      },
    },
    'apps.resolveToken': {
      cache: {
        keys: [],
      },
    },
    'users.logout': {
      auth: EndpointType.PUBLIC,
      rest: 'POST /logout',
    },
    login: {
      auth: EndpointType.PUBLIC,
      rest: 'POST /login',
    },
    'evartai.sign': {
      auth: EndpointType.PUBLIC,
      rest: 'POST /evartai/sign',
    },
    'evartai.login': {
      auth: EndpointType.PUBLIC,
      rest: 'POST /evartai/login',
    },
    refreshToken: {
      auth: EndpointType.PUBLIC,
      rest: 'POST /refresh',
    },
    changePasswordVerify: {
      auth: EndpointType.PUBLIC,
      rest: 'POST /change/verify',
    },
    changePasswordAccept: {
      auth: EndpointType.PUBLIC,
      rest: 'POST /change/accept',
    },
  },
  hooks: {
    after: {
      login: 'afterUserLoggedIn',
      'evartai.login': 'afterUserLoggedIn',
    },
    before: {
      'evartai.login': 'beforeUserLogin',
    },
  },
})
export default class AuthService extends moleculer.Service {
  @Action({
    cache: {
      keys: ['#user.id'],
    },
    rest: <RestSchema>{
      method: 'GET',
      basePath: '/users',
      path: '/me',
    },
  })
  async me(ctx: Context<{}, UserAuthMeta>) {
    const { user, authUser } = ctx.meta;
    const data: any = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      type: user.type,
    };

    if (authUser?.permissions?.SMALSUOLIS) {
      data.permissions = {
        SMALSUOLIS: authUser.permissions.SMALSUOLIS,
      };
    }

    return data;
  }

  @Action({
    cache: {
      keys: ['types', '#user.id'],
    },
    params: {
      types: {
        type: 'array',
        items: 'string',
        enum: Object.values(EndpointType),
      },
    },
  })
  async validateType(ctx: Context<{ types: EndpointType[] }, UserAuthMeta>) {
    const { types } = ctx.params;
    const { user } = ctx.meta;
    const userType = user.type;
    if (!types || !types.length) return true;

    let result = false;
    if (types.includes(EndpointType.ADMIN)) {
      result = result || userType === UserType.ADMIN;
    }

    if (types.includes(EndpointType.USER)) {
      result = result || userType === UserType.USER;
    }

    return result;
  }

  @Method
  async afterUserLoggedIn(ctx: any, data: any) {
    if (!data || !data.token) return data;

    const meta = { authToken: data.token };

    const authUser: any = await this.broker.call('auth.users.resolveToken', null, { meta });

    const user: User = await ctx.call('users.findOrCreate', {
      authUser: authUser,
      update: true,
    });

    if (user.type === UserType.ADMIN && process.env.NODE_ENV !== 'local') {
      return throwNotFoundError();
    }

    return data;
  }

  @Method
  async beforeUserLogin(ctx: any) {
    ctx.params = ctx.params || {};
    ctx.params.refresh = true;

    return ctx;
  }

  @Event()
  async 'cache.clean.auth'() {
    await this.broker.cacher?.clean(`${this.fullName}.**`);
  }
}
