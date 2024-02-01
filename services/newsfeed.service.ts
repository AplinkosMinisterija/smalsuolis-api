'use strict';
import { isEmpty } from 'lodash';
import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
import { intersectsQuery } from 'moleculer-postgis';
import { UserAuthMeta } from '../types';
import { parseToJsonIfNeeded } from '../utils';
import { Event } from './events.service';
import { Subscription } from './subscriptions.service';

@Service({
  name: 'newsfeed',
})
export default class NewsfeedService extends moleculer.Service {
  @Action({
    rest: 'GET /',
  })
  async getNewsFeed(ctx: Context<any, UserAuthMeta>): Promise<any> {
    const { user } = ctx.meta;

    ctx.params.query = parseToJsonIfNeeded(ctx.params.query) || {};

    const subscriptions: Subscription[] = await ctx.call('subscriptions.find', {
      query: {
        user: user.id,
        active: true,
      },
      populate: ['geom'],
    });

    if (!isEmpty(subscriptions)) {
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
    }

    const events: Event[] = await ctx.call('events.list', {
      ...ctx,
      query: { ...ctx.params.query },
    });

    return events;
  }
}
