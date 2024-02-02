'use strict';
import { isEmpty } from 'lodash';
import moleculer, { Context } from 'moleculer';
import { Action, Method, Service } from 'moleculer-decorators';
import { intersectsQuery } from 'moleculer-postgis';
import { UserAuthMeta } from '../types';
import { parseToJsonIfNeeded } from '../utils';
import { Subscription } from './subscriptions.service';

@Service({
  name: 'newsfeed',

  hooks: {
    before: {
      list: ['applyFilters'],
      find: ['applyFilters'],
      get: ['applyFilters'],
      resolve: ['applyFilters'],
    },
  },
})
export default class NewsfeedService extends moleculer.Service {
  @Action({
    rest: 'GET /',
  })
  async list(ctx: Context<any, UserAuthMeta>) {
    return ctx.call('events.list', {
      ...ctx,
      query: { ...ctx.params.query },
    });
  }

  @Action()
  async find(ctx: Context<any, UserAuthMeta>) {
    return ctx.call('events.find', {
      ...ctx,
      query: { ...ctx.params.query },
    });
  }

  @Action()
  async get(ctx: Context<any, UserAuthMeta>) {
    const { id } = ctx.params;
    return ctx.call('events.get', {
      ...ctx,
      id,
      query: { ...ctx.params.query },
    });
  }

  @Action()
  async resolve(ctx: Context<any, UserAuthMeta>) {
    const { id } = ctx.params;
    return ctx.call('events.resolve', {
      ...ctx,
      id,
      query: { ...ctx.params.query },
    });
  }

  @Method
  async applyFilters(ctx: Context<any, UserAuthMeta>) {
    ctx.params.query = parseToJsonIfNeeded(ctx.params.query) || {};
    const { user } = ctx.meta;

    const subscriptions: Subscription[] = await ctx.call('subscriptions.find', {
      query: {
        user: user.id,
        active: true,
      },
      populate: ['geom'],
    });

    if (isEmpty(subscriptions)) {
      ctx.params.query.$or = { app: { $in: [] } };
      return ctx;
    }

    const subscriptionQuery = subscriptions.map((subscription) => ({
      app: { $in: subscription.apps },
      $raw: intersectsQuery('geom', subscription.geom, 3346),
    }));

    if (ctx?.params?.query?.$or) {
      ctx.params.query.$and = [ctx?.params?.query?.$or, { $or: subscriptionQuery }];
      delete ctx?.params?.query?.$or;
    } else {
      ctx.params.query.$or = subscriptionQuery;
    }

    return ctx;
  }
}
