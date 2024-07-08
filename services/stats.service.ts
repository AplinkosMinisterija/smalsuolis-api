'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
import { Tag } from './tags.service';
import { Event } from './events.service';
import { App, APP_TYPE } from './apps.service';

@Service({
  name: 'stats',
})
export default class StatsService extends moleculer.Service {
  @Action()
  async all(ctx: Context<{ query?: any }>) {
    const tagsById: { [key: string]: Tag } = await ctx.call('tags.find', { mapping: 'id' });

    const events: Event<'app'>[] = await ctx.call('events.find', {
      query: ctx.params.query,
      populate: ['app'],
    });

    const stats: {
      count: number;

      byApp: {
        [key: App['key']]: {
          count: number;
          byTag?: { [key: Tag['name']]: { count: number } };
        };
      };
    } = {
      byApp: {},
      count: 0,
    };

    stats.count = events.length;

    events?.forEach((e) => {
      const appType = APP_TYPE[e.app.key];
      const appStats = stats.byApp[appType] || { count: 0 };
      appStats.count++;

      e.tags?.forEach((t) => {
        const tagKey = `${tagsById[t].name}`;
        if (!tagKey) return;
        appStats.byTag = appStats.byTag || {};
        appStats.byTag[tagKey] = appStats.byTag[tagKey] || { count: 0 };
        appStats.byTag[tagKey].count++;
      });

      stats.byApp[appType] = appStats;
    });

    return stats;
  }
}
