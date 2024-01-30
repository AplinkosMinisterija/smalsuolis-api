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
import { ServerClient } from 'postmark';
import { lt } from 'date-fns/locale';
import { format } from 'date-fns/format';

const Cron = require('@r2d2bzh/moleculer-cron');

export function emailCanBeSent() {
  return ['production', 'staging'].includes(process.env.NODE_ENV);
}

const sender = 'noreply@biip.lt';

const client = new ServerClient(process.env.POSTMARK_KEY);

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
        required: true,
        columnType: 'integer',
        columnName: 'userId',
        populate: 'users.get',
      },
      apps: {
        //apps subscribed to
        type: 'array',
        required: true,
        items: { type: 'number' },
        columnName: 'apps',
        populate(ctx: any, _values: any, items: Subscription[]) {
          return Promise.all(
            items.map((item: any) => {
              if (!item.appsIds) return [];
              if (typeof item.appsIds === 'string') item.appsIds = JSON.parse(item.appsIds);
              return ctx.call('apps.resolve', { id: item.appsIds });
            }),
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
      cronTime: '0 12 * * *',
      async onTick() {
        const currentDate = new Date();
        const dayAgo = new Date(currentDate.setDate(currentDate.getDate() - 1));
        await this.call('subscriptions.handleEmails', { date: dayAgo, frequency: Frequency.DAY });
      },
      timeZone: 'Europe/Vilnius',
    },
    {
      name: 'weeklyEmails',
      cronTime: '0 13 * * 1',
      async onTick() {
        const currentDate = new Date();
        const weekAgo = new Date(currentDate.setDate(currentDate.getDate() - 7));
        await this.call('subscriptions.handleEmails', { date: weekAgo, frequency: Frequency.WEEK });
      },
      timeZone: 'Europe/Vilnius',
    },
    {
      name: 'monthlyEmails',
      cronTime: '0 15 1 * *',
      async onTick() {},
      timeZone: 'Europe/Vilnius',
    },
  ],
})
export default class SubscriptionsService extends moleculer.Service {
  @Action()
  async handleEmails(ctx: Context<{ date: Date; frequency: Frequency }>) {
    const { date, frequency } = ctx.params;
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
    });
    for (const sub of subscriptions) {
      const subEvents = events
        .filter((e) => sub.apps.includes(e.app.id))
        .map((e) => ({
          app_name: e.app.name,
          event_name: e.name,
          date: format(new Date(e.startAt), "yyyy 'm.' MMMM d 'd.'", {
            locale: lt,
          }),
          event_content: e.body,
        }));

      if (!emailCanBeSent()) return;
      const content = {
        From: sender,
        To: sub.user.email,
        TemplateId: 34626749,
        TemplateModel: {
          name: `${sub.user.firstName} ${sub.user.lastName}`,
          events: subEvents,
        },
      };
      await client.sendEmailWithTemplate(content);
    }
  }
}
