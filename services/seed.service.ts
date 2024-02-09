'use strict';

import moleculer, { Context, ServiceBroker } from 'moleculer';
import { Action, Method, Service } from 'moleculer-decorators';
import { APPS, App } from './apps.service';

@Service({
  name: 'seed',
})
export default class SeedService extends moleculer.Service {
  @Action()
  async real(ctx: Context<Record<string, unknown>>) {
    const usersCount: number = await ctx.call('users.count');

    if (!usersCount) {
      const data: any[] = await ctx.call('auth.getSeedData');

      for (const item of data) {
        await ctx.call('users.findOrCreate', {
          authUser: item,
          update: true,
        });
      }
    }

    const apps: Record<string, App['id']> = await this.seedApps(ctx);

    await this.infostatyba(ctx, apps.infostatyba);

    return true;
  }

  @Method
  async seedApps(ctx: Context) {
    await this.broker.waitForServices(['apps']);
    const idsMap: Record<string, App['id']> = {};

    for (const [key, data] of Object.entries(APPS)) {
      let app: App = await ctx.call('apps.findOne', {
        query: { key },
      });

      if (!app) {
        app = await ctx.call('apps.create', <Partial<App>>{
          key,
          ...data,
        });
      }

      idsMap[key] = app.id;
    }

    return idsMap;
  }

  @Method
  async infostatyba(ctx: Context, app: App['id']) {
    await this.broker.waitForServices(['datagov']);

    const count: number = await ctx.call('events.count', {
      query: { app },
    });

    if (!count) {
      await ctx.call('datagov.infostatyba', { limit: 100 });
    }
  }

  @Action()
  async fake(ctx: Context<Record<string, unknown>>) {}

  @Action()
  run() {
    return this.broker.waitForServices(['auth', 'users']).then(async () => {
      await this.broker.call('seed.real', {}, { timeout: 120 * 1000 });
    });
  }
}
