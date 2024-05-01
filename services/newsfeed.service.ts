'use strict';
import moleculer, { Context } from 'moleculer';
import { Action, Method, Service } from 'moleculer-decorators';
import { Frequency, FrequencyLabel, UserAuthMeta } from '../types';
import { parseToJsonIfNeeded, emailCanBeSent, getDateByFrequency, truncateString } from '../utils';
import { Subscription } from './subscriptions.service';
import { Event, applyEventsQueryBySubscriptions } from './events.service';
import { format } from 'date-fns/format';
import { lt } from 'date-fns/locale';
import { ServerClient } from 'postmark';
import { User } from './users.service';
import showdown from 'showdown';

const Cron = require('@r2d2bzh/moleculer-cron');

const sender = 'esu@smalsuolis.lt';

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
    return ctx.call('events.list', ctx.params);
  }

  @Action()
  async find(ctx: Context<any, UserAuthMeta>) {
    return ctx.call('events.find', ctx.params);
  }

  @Action()
  async get(ctx: Context<any, UserAuthMeta>) {
    return ctx.call('events.get', ctx.params);
  }

  @Action()
  async resolve(ctx: Context<any, UserAuthMeta>) {
    return ctx.call('events.resolve', ctx.params);
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
      populate: ['user', 'geomWithBuffer'],
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

    const markdownConverter = new showdown.Converter();

    // for each user
    for (const key in subscriptionsMap) {
      const data = subscriptionsMap[key];
      if (!data?.subscriptions?.length) {
        continue;
      }

      const query = applyEventsQueryBySubscriptions({}, data.subscriptions);
      //select events
      const events: Event<'app'>[] = await this.broker.call('events.find', {
        query: {
          createdAt: { $gt: date },
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

      function formatDateByEvent(e: Event<'app'>) {
        const dayFormat = "yyyy 'm.' MMMM d 'd.'";
        const dayAndTimeFormat = `${dayFormat} HH:mm`;

        const startDate = e.startAt
          ? format(new Date(e.startAt), e.isFullDay ? dayFormat : dayAndTimeFormat, {
              locale: lt,
            })
          : '';

        const endDate = e.endAt
          ? format(new Date(e.endAt), e.isFullDay ? dayFormat : dayAndTimeFormat, {
              locale: lt,
            })
          : '';

        if (!startDate) return '';
        else if (!endDate) return startDate;
        return `${startDate} - ${endDate}`;
      }

      // otherwise send email
      const mappedEvents = events.slice(0, 6).map((e) => ({
        app_name: e.app.name,
        event_name: e.name,
        date: formatDateByEvent(e),
        event_content: markdownConverter.makeHtml(truncateString(e.body, 500)),
        url: e.url || `${process.env.APP_HOST}/visos-naujienos/${e.id}`,
      }));
      const content = {
        From: sender,
        To: data.user.email,
        TemplateId: 34626749,
        TemplateModel: {
          frequency: FrequencyLabel[frequency],
          total_events: events.length,
          events: mappedEvents,
          action_url: `${process.env.APP_HOST}/mano-naujienos`,
        },
      };
      await this.client.sendEmailWithTemplate(content);
    }
  }

  @Method
  async applyFilters(ctx: Context<any, UserAuthMeta>) {
    ctx.params.query = parseToJsonIfNeeded(ctx.params.query) || {};
    const { user } = ctx.meta;

    const query: any = {
      user: user.id,
      active: true,
    };

    // we need to filter subscriptions in the first place
    if (ctx.params.query.subscription) {
      query.id = ctx.params.query.subscription;
      delete ctx.params.query.subscription;
    }

    const subscriptions: Subscription[] = await ctx.call('subscriptions.find', {
      query,
      fields: ['id'],
    });

    if (!subscriptions?.length) {
      // TODO: hack for returning 0 items
      ctx.params.query.$or = { app: { $in: [] } };
      return ctx;
    }

    ctx.params.query.subscription = {
      $in: subscriptions?.map((i) => i.id),
    };

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
