'use strict';
import moleculer, { Context } from 'moleculer';
import { Action, Method, Service } from 'moleculer-decorators';
import { Frequency, FrequencyLabel, QueryObject, UserAuthMeta } from '../types';
import { parseToJsonIfNeeded, emailCanBeSent, getDateByFrequency, truncateString } from '../utils';
import { Subscription } from './subscriptions.service';
import { Event } from './events.service';
import { format } from 'date-fns/format';
import { lt } from 'date-fns/locale';
import { ServerClient } from 'postmark';
import { User } from './users.service';
import { intersectsQuery } from 'moleculer-postgis';

const Cron = require('@r2d2bzh/moleculer-cron');

const sender = 'noreply@biip.lt';

// returns query with apps and geom filtering based on provided subscriptions.
function applyNewsfeedFilters(query: QueryObject, subscriptions: Subscription[]) {
  if (!subscriptions?.length) {
    query.$or = { app: { $in: [] } };
    return query;
  }
  const subscriptionQuery = subscriptions.map((subscription) => ({
    ...(!!subscription.apps?.length && { app: { $in: subscription.apps } }),
    $raw: intersectsQuery('geom', subscription.geom, 3346),
  }));
  if (query?.$or) {
    query.$and = [query?.$or, { $or: subscriptionQuery }];
    delete query?.$or;
  } else {
    query.$or = subscriptionQuery;
  }
  return query;
}

@Service({
  name: 'newsfeed',
  mixins: [Cron],
  hooks: {
    before: {
      list: ['applyFilters'],
      find: ['applyFilters'],
      get: ['applyFilters'],
      resolve: ['applyFilters'],
    },
  },
  crons: [
    {
      name: 'dailyEmails',
      cronTime: '0 12 * * *',
      async onTick() {
        await this.call('newsfeed.handleEmails', { frequency: Frequency.DAY });
      },
      timeZone: 'Europe/Vilnius',
    },
    {
      name: 'weeklyEmails',
      cronTime: '0 13 * * 1',
      async onTick() {
        await this.call('newsfeed.handleEmails', { frequency: Frequency.WEEK });
      },
      timeZone: 'Europe/Vilnius',
    },
    {
      name: 'monthlyEmails',
      cronTime: '0 15 1 * *',
      async onTick() {
        await this.call('newsfeed.handleEmails', { frequency: Frequency.MONTH });
      },
      timeZone: 'Europe/Vilnius',
    },
  ],
})
export default class NewsfeedService extends moleculer.Service {
  @Action({
    rest: 'GET /',
  })
  async list(ctx: Context<any, UserAuthMeta>) {
    return ctx.call('events.list', {
      ...ctx.params,
    });
  }

  @Action()
  async find(ctx: Context<any, UserAuthMeta>) {
    return ctx.call('events.find', {
      ...ctx.params,
    });
  }

  @Action()
  async get(ctx: Context<any, UserAuthMeta>) {
    const { id } = ctx.params;
    return ctx.call('events.get', {
      ...ctx.params,
      id,
    });
  }

  @Action()
  async resolve(ctx: Context<any, UserAuthMeta>) {
    const { id } = ctx.params;
    return ctx.call('events.resolve', {
      ...ctx.params,
      id,
    });
  }

  @Action()
  async handleEmails(ctx: Context<{ frequency: Frequency }>) {
    if (!emailCanBeSent()) return;
    const frequency = ctx.params.frequency;
    const date = getDateByFrequency(frequency);
    //select active subscriptions by frequency
    const subscriptions: Subscription<'user'>[] = await ctx.call('subscriptions.find', {
      query: {
        frequency,
        active: true,
      },
      populate: 'user',
      scope: '-user',
    });

    //do nothing if there are no active subscriptions
    if (!subscriptions.length) {
      return;
    }
    //map subscriptions by user
    const subscriptionsMap = subscriptions.reduce(
      (aggregate: { [key: number]: { user: User; subscriptions: Subscription[] } }, value) => {
        const record: any = aggregate[value.user.id];
        return {
          ...aggregate,
          [value.user.id]: {
            user: value.user,
            subscriptions: record?.subscriptions ? [...record.subscriptions, value] : [value],
          },
        };
      },
      {},
    );
    // for each user
    for (const key in subscriptionsMap) {
      const data = subscriptionsMap[key];
      const query = applyNewsfeedFilters({}, data.subscriptions);
      //select events
      const events: Event<'app'>[] = await this.broker.call('events.find', {
        query: {
          startAt: { $gt: date },
          ...query,
        },
        fields: ['id', 'app', 'name', 'body', 'startAt'],
        populate: 'app',
        sort: '-startAt',
      });
      // proceed to next user if no events
      if (!events.length) {
        continue;
      }
      // otherwise send email
      const mappedEvents = events.slice(0, 6).map((e) => ({
        app_name: e.app.name,
        event_name: e.name,
        date: format(new Date(e.startAt), "yyyy 'm.' MMMM d 'd.'", {
          locale: lt,
        }),
        event_content: truncateString(e.body, 500),
        url: e.url,
      }));
      const content = {
        From: sender,
        To: data.user.email,
        TemplateId: 34626749,
        TemplateModel: {
          frequency: FrequencyLabel[frequency],
          total_events: events.length,
          events: mappedEvents,
          action_url: 'https://smalsuolis.lt', //TODO: replace with the actual link
        },
      };
      await this.client.sendEmailWithTemplate(content);
    }
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

    ctx.params.query = applyNewsfeedFilters(ctx.params.query, subscriptions);

    return ctx;
  }

  created() {
    if (emailCanBeSent()) {
      if (!process.env.POSTMARK_KEY) {
        this.broker.fatal('POSTMARK is not configured');
      }
      this.client = new ServerClient(process.env.POSTMARK_KEY);
    } else {
      this.client = {
        sendEmailWithTemplate: (...args: unknown[]) => console.log('Sending email', ...args),
      };
    }
  }
}
