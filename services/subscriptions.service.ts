'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Method, Service } from 'moleculer-decorators';
import DbConnection from '../mixins/database.mixin';
import {
  BaseModelInterface,
  COMMON_DEFAULT_SCOPES,
  COMMON_FIELDS,
  COMMON_SCOPES,
  Frequency,
  TemplateModel,
} from '../types';
import { User } from './users.service';
import { Event } from './events.service';
import moment from 'moment';
import { ServerClient } from 'postmark';

const Cron = require('@r2d2bzh/moleculer-cron');

export function emailCanBeSent() {
  return ['production', 'staging'].includes(process.env.NODE_ENV);
}

const sender = 'noreply@biip.lt';

const client = new ServerClient(process.env.POSTMARK_KEY);

function getAppsFromEvents(events: Event[]): number[] {
  return events.reduce((accumulator, value) => {
    const app = value.app;
    if (!accumulator.includes(app)) {
      return [...accumulator, app];
    }
    return accumulator;
  }, []);
}

function filterEvents(events: Event[], date: Date) {
  return events.filter((e) => e.startAt > date);
}

export interface Subscription extends BaseModelInterface {
  id: number;
  user: User['id'];
  apps: number[];
  frequency: Frequency;
  active: boolean;
  lastSent: Date;
}

@Service({
  name: 'subscriptions',
  mixins: [DbConnection({ collection: 'subscriptions' }), Cron],
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
        columnType: 'integer',
        columnName: 'userId',
        populate: 'users.get',
      },
      apps: {
        //apps subscribed to
        type: 'array',
        items: { type: 'number' },
        columnName: 'apps',
        populate(ctx: any, _values: any, items: Subscription[]) {
          return Promise.all(
            items.map((item: any) => {
              if (!item.appsIds) return [];
              if (typeof item.appsIds === 'string')
                item.appsIds = JSON.parse(item.appsIds);
              return ctx.call('apps.resolve', { id: item.appsIds });
            })
          );
        },
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
      ...COMMON_SCOPES,
    },
    defaultScopes: [...COMMON_DEFAULT_SCOPES],
  },
  actions: {
    list: {
      rest: null,
    },
    count: {
      rest: null,
    },
  },
  crons: [
    {
      name: 'dailyEmails',
      cronTime: '0 8 * * *',
      async onTick() {
        this.call('subscriptions.handleDailyEmails');
      },
      timeZone: 'Europe/Vilnius',
    },
    {
      name: 'weeklyEmails',
      cronTime: '0 9 * * 1',
      async onTick() {
        this.call('subscriptions.handleWeeklyEmails');
      },
      timeZone: 'Europe/Vilnius',
    },
    {
      name: 'monthlyEmails',
      cronTime: '0 10 1 * *',
      async onTick() {
        this.call('subscriptions.handleMonthlyEmails');
      },
      timeZone: 'Europe/Vilnius',
    },
  ],
})
export default class SubscriptionsService extends moleculer.Service {
  @Action()
  async handleDailyEmails(ctx: Context) {
    const currentDate = new Date();
    const dayAgo = new Date(currentDate.setDate(currentDate.getDate() - 1));
    await this.handleEmails(dayAgo, Frequency.DAY);
  }

  @Action()
  async handleWeeklyEmails(ctx: Context) {
    const currentDate = new Date();
    const weekAgo = new Date(currentDate.setDate(currentDate.getDate() - 7));
    await this.handleEmails(weekAgo, Frequency.WEEK);
  }

  @Action()
  async handleMonthlyEmails(ctx: Context) {}

  @Method
  async handleEmails(date: Date, frequency: Frequency) {
    const subscriptions = await this.findEntities(null, {
      query: {
        frequency,
        active: true,
      },
      populate: 'user',
    });

    if (!subscriptions.length) {
      return;
    }
    //TODO: type needs to be fixed in events.service first
    const events: any[] = await this.broker.call('events.find', {
      query: {
        startAt: { $gt: date },
      },
      populate: 'app',
      sort: '-startAt',
    });
    for (const sub of subscriptions) {
      const subEvents = events
        .filter((e) => sub.apps.includes(e.app.id))
        .map((e) => ({
          app_name: e.app.name,
          event_name: e.name,
          date: moment(e.startAt).locale('lt').format('YYYY [m.] MMMM DD [d.]'),
          event_content: e.body,
        }));

      await this.sendEmail(sub.user.email, {
        name: sub.user.name,
        events: subEvents,
      });
    }
  }

  @Method
  async sendEmail(email: string, data: TemplateModel) {
    if (!emailCanBeSent()) return;
    const content = {
      From: sender,
      To: email,
      TemplateId: 34626749,
      TemplateModel: data,
    };
    return client.sendEmailWithTemplate(content);
  }
}
