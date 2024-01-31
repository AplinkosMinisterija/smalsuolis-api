'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
import DbConnection from '../mixins/database.mixin';
import {
  COMMON_DEFAULT_SCOPES,
  COMMON_FIELDS,
  COMMON_SCOPES,
  CommonFields,
  CommonPopulates,
  Frequency,
  FrequencyLabel,
  Table,
} from '../types';
import { User } from './users.service';
import { Event } from './events.service';
import { ServerClient } from 'postmark';
import { lt } from 'date-fns/locale';
import { format } from 'date-fns/format';
import { App } from './apps.service';
import { emailCanBeSent, getDateByFrequency, truncateString } from '../utils';
import PostgisMixin from 'moleculer-postgis';

const Cron = require('@r2d2bzh/moleculer-cron');

const sender = 'noreply@biip.lt';

interface Fields extends CommonFields {
  user: User['id'];
  apps: number[];
  frequency: Frequency;
  active: boolean;
  lastSent: Date;
}

interface Populates extends CommonPopulates {
  apps: App[];
  user: User;
}

export type Subscription<
  P extends keyof Populates = never,
  F extends keyof (Fields & Populates) = keyof Fields,
> = Table<Fields, Populates, P, F>;

@Service({
  name: 'subscriptions',
  mixins: [DbConnection({ collection: 'subscriptions' }), PostgisMixin({ srid: 3346 }), Cron],
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
            items.map((item: Subscription) => {
              if (!item.apps) return [];
              if (typeof item.apps === 'string') item.apps = JSON.parse(item.apps);
              return ctx.call('apps.resolve', { id: item.apps });
            }),
          );
        },
      },
      geom: {
        type: 'any',
        geom: true,
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
        await this.call('subscriptions.handleEmails', { frequency: Frequency.DAY });
      },
      timeZone: 'Europe/Vilnius',
    },
    {
      name: 'weeklyEmails',
      cronTime: '0 13 * * 1',
      async onTick() {
        await this.call('subscriptions.handleEmails', { frequency: Frequency.WEEK });
      },
      timeZone: 'Europe/Vilnius',
    },
    {
      name: 'monthlyEmails',
      cronTime: '0 15 1 * *',
      async onTick() {
        await this.call('subscriptions.handleEmails', { frequency: Frequency.MONTH });
      },
      timeZone: 'Europe/Vilnius',
    },
  ],
})
export default class SubscriptionsService extends moleculer.Service {
  @Action()
  async handleEmails(ctx: Context<{ frequency: Frequency }>) {
    if (!emailCanBeSent()) return;
    const frequency = ctx.params.frequency;
    const date = getDateByFrequency(frequency);
    const subscriptions = await this.findEntities(ctx, {
      query: {
        frequency,
        active: true,
      },
      populate: 'user',
    });

    if (!subscriptions.length) {
      return;
    }

    const events: Event<'app'>[] = await this.broker.call('events.find', {
      query: {
        startAt: { $gt: date },
      },
      fields: ['id', 'app', 'name', 'body', 'startAt'],
      populate: 'app',
      sort: '-startAt',
    });

    for (const sub of subscriptions) {
      const filtered = events.filter((e) => sub.apps.includes(e.app.id));
      if (filtered.length) {
        const mappedEvents = filtered.slice(0, 6).map((e) => ({
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
          To: sub.user.email,
          TemplateId: 34626749,
          TemplateModel: {
            frequency: FrequencyLabel[frequency],
            total_events: filtered.length,
            events: mappedEvents,
            action_url: 'https://smalsuolis.lt', //TODO: replace with the actual link
          },
        };
        await this.client.sendEmailWithTemplate(content);
      }
    }
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
