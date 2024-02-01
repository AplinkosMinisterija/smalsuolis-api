'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
import { EndpointType, UserAuthMeta } from '../types';
import { parseToJsonIfNeeded } from '../utils';
import { Subscription } from './subscriptions.service';

@Service({
  name: 'events',

  settings: {},

  actions: {
    list: {
      auth: EndpointType.PUBLIC,
    },
    get: {
      rest: null,
    },
    find: {
      auth: EndpointType.PUBLIC,
    },
    count: {
      rest: null,
    },
  },
})
export default class EventsService extends moleculer.Service {
  @Action({
    rest: 'GET /',
  })
  async getNewsFeed(ctx: Context<any, UserAuthMeta>): Promise<any> {
    const { user } = ctx.meta;

    ctx.params.query = parseToJsonIfNeeded(ctx.params.query);

    const subscriptions: Subscription[] = await ctx.call('subscriptions.find', {
      query: {
        user: user.id,
        active: true,
      },
    });

    if (!ctx?.params?.query?.$or) {
      ctx.params.query.$or = subscriptions.map((subscription) => ({
        apps: { $in: subscription.apps },
        geom: subscription.geom,
      }));
    }

    //  const events: Subscription[] = await ctx.call('events.list', { ...ctx });

    return [];
  }
}
