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
} from '../types';
import { User } from './users.service';
import { Event } from './events.service';

const Cron = require('@r2d2bzh/moleculer-cron');

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
        columnName: 'appsIds',
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
      lastSent: { date: 'date', columnType: 'datetime' }, // last time email was sent
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
      name: 'sendEmails',
      cronTime: '* * * * *',
      async onTick() {
        this.call('subscriptions.sendEmails');
      },
      timeZone: 'Europe/Vilnius',
    },
  ],
})
export default class SubscriptionsService extends moleculer.Service {
  @Action()
  async sendEmails(ctx: Context) {
    console.log('sendEmails!!!');
    // Get events within a mont
    const currentDate = new Date();
    const monthsAgo = new Date(currentDate.setDate(currentDate.getDate() - 30));
    const monthlyEvents: Event[] = await ctx.call('events.find', {
      query: {
        startAt: { $gt: monthsAgo },
      },
    });
    await this.handleEmails(monthlyEvents, monthsAgo);
    const weekAgo = new Date(currentDate.setDate(currentDate.getDate() - 7));
    const weekEvents: Event[] = filterEvents(monthlyEvents, weekAgo);
    await this.handleEmails(weekEvents, weekAgo);
    const dayAgo = new Date(currentDate.setDate(currentDate.getDate() - 1));
    const dayEvents = filterEvents(weekEvents, dayAgo);
    await this.handleEmails(dayEvents, dayAgo);
  }

  @Method
  async handleEmails(events: Event[], date: Date) {
    console.log('sendEmails111');

    // if (events.length) {
    //   const apps = getAppsFromEvents(events);
    const apps = [1, 5];
    const subscriptions = await this.findEntities(null, {
      query: {
        lastSent: { $lte: date },
        active: true,
        apps: {
          $contains: {
            $or: apps.map((value) => ({ $in: { items: [value] } })),
          },
        },
      },
    });
    console.log('subsqqq', subscriptions);
    // get subscribers who need monthly update for app events
    // send emails
    // update lastSent
    // }
  }
}
