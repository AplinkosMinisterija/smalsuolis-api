'use strict';

import moleculer, { Context, ServiceBroker } from 'moleculer';
import { Action, Method, Service } from 'moleculer-decorators';
import { App, APP_TYPES } from './apps.service';
import { DATAGOV_APPS } from './datagov.service';

const APPS = {
  [DATAGOV_APPS.infostatybaNaujas]: {
    type: APP_TYPES.infostatyba,
    name: 'Statinio statyba',
    description: 'Naujų statinių statybos leidimai',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
  },
  [DATAGOV_APPS.infostatybaRemontas]: {
    type: APP_TYPES.infostatyba,
    name: 'Statinio remontas/rekonstravimas',
    description: 'Statinių kapitalinių ir paprastųjų remontų arba rekonstravimų leidimai',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
  },
  [DATAGOV_APPS.infostatybaGriovimas]: {
    type: APP_TYPES.infostatyba,
    name: 'Statinio griovimas',
    description: 'Statinių griovimo leidimai',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
  },
  [DATAGOV_APPS.infostatybaPaskirtiesKeitimas]: {
    type: APP_TYPES.infostatyba,
    name: 'Statinio/patalpų paskirties keitimas',
    description: 'Statinių/patalpų paskirties keitimų leidimai - statybos darbai neatliekami',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
  },
  izuvinimas: {
    type: APP_TYPES.izuvinimas,
    name: 'Žuvų įveisimas',
    description: 'Įžuvinimų informacinė sistema',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 16C2 16 11 1 22 12C11 23 2 8 2 8" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  },
  miskoKirtimai: {
    type: APP_TYPES.miskoKirtimai,
    name: 'Miško kirtimai',
    description: 'TODO: kirtimai description',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 16C2 16 11 1 22 12C11 23 2 8 2 8" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  },
};

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

    const apps: Record<string, App['id'][]> = await this.seedApps(ctx);
    await this.infostatyba(ctx, apps.infostatyba);
    await this.fishStockings(ctx, apps.izuvinimas);
    return true;
  }

  @Method
  async seedApps(ctx: Context) {
    await this.broker.waitForServices(['apps']);
    const idsMap: Record<string, App['id'][]> = {};

    for (const [key, data] of Object.entries(APPS)) {
      let app: App = await ctx.call('apps.findOne', {
        query: { key },
      });

      const appType = data.type;
      delete data.type; // App don't have this prop
      if (!app) {
        app = await ctx.call('apps.create', <Partial<App>>{
          key,
          ...data,
        });
      }

      // map by type
      idsMap[appType] = [...(idsMap[appType] || []), app.id];
    }

    return idsMap;
  }

  @Method
  async infostatyba(ctx: Context, appsIds: App['id'][]) {
    await this.broker.waitForServices(['datagov', 'events']);

    const count: number = await ctx.call('events.count', {
      query: { app: { $in: appsIds } },
    });

    if (!count) {
      await ctx.call('datagov.infostatyba', { limit: 100 });
    }
  }

  @Method
  async fishStockings(ctx: Context, appsIds: App['id'][]) {
    await this.broker.waitForServices(['integrations.fishStockings', 'events']);

    const count: number = await ctx.call('events.count', {
      query: { app: { $in: appsIds } },
    });

    if (!count) {
      await ctx.call('integrations.fishStockings.getData', { limit: 100 });
    }
  }

  @Action()
  async fake(ctx: Context<Record<string, unknown>>) {}

  @Action({
    timeout: 0,
  })
  run() {
    return this.broker.waitForServices(['auth', 'users']).then(async () => {
      await this.broker.call('seed.real', {}, { timeout: 120 * 1000 });
    });
  }
}
