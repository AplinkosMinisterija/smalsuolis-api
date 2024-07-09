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
  @Action({
    rest: 'GET /',
  })
  async all(ctx: Context<{ query?: any }>) {
    const tagsById: { [key: string]: Tag } = await ctx.call('tags.find', { mapping: 'id' });

    const events: Event<'app', 'id' | 'app' | 'tags' | 'tagsData'>[] = await ctx.call(
      'events.find',
      {
        query: ctx.params.query,
        populate: ['app'],
        fields: ['id', 'app', 'tags', 'tagsData'],
      },
    );

    const stats: {
      count: number;

      byApp: {
        [key: App['key']]: {
          count: number;
          byTag?: { [key: Tag['name']]: { count: number; [key: string]: number } };
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

        if (e.tagsData?.length) {
          const matchingTags = e.tagsData.filter((i) => i.id === t);
          matchingTags?.forEach((tag) => {
            appStats.byTag[tagKey][tag.name] = appStats.byTag[tagKey][tag.name] || 0;
            appStats.byTag[tagKey][tag.name] += tag.value;
          });
        }
      });

      stats.byApp[appType] = appStats;
    });

    return stats;
  }
}
