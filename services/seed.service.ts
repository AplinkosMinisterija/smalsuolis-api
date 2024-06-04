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
    description: 'Miško kirtimų informacinė sistema',
    icon: '<svg width="24" height="24" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.75 9.5L13 11.975C13.1028 12.0798 13.1725 12.2125 13.2006 12.3566C13.2287 12.5007 13.2139 12.6499 13.158 12.7856C13.1021 12.9214 13.0076 13.0377 12.8861 13.1203C12.7647 13.2028 12.6218 13.2479 12.475 13.25H1.52499C1.37819 13.2479 1.23523 13.2028 1.11383 13.1203C0.992422 13.0377 0.897912 12.9214 0.842014 12.7856C0.786117 12.6499 0.77129 12.5007 0.799371 12.3566C0.827452 12.2125 0.897207 12.0798 0.999988 11.975L3.24999 9.5H3.02499C2.87819 9.49794 2.73523 9.45284 2.61383 9.37029C2.49242 9.28775 2.39791 9.17139 2.34201 9.03564C2.28612 8.89988 2.27129 8.75071 2.29937 8.60661C2.32745 8.46252 2.39721 8.32983 2.49999 8.225L4.74999 5.75H4.59999C4.4468 5.76382 4.29307 5.7302 4.15962 5.65371C4.02618 5.57722 3.91948 5.46155 3.85399 5.32238C3.7885 5.18321 3.76738 5.02727 3.7935 4.87569C3.81961 4.72411 3.8917 4.58423 3.99999 4.475L6.99999 1.25L9.99999 4.475C10.1083 4.58423 10.1804 4.72411 10.2065 4.87569C10.2326 5.02727 10.2115 5.18321 10.146 5.32238C10.0805 5.46155 9.97379 5.57722 9.84035 5.65371C9.70691 5.7302 9.55318 5.76382 9.39999 5.75H9.24999L11.5 8.225C11.6028 8.32983 11.6725 8.46252 11.7006 8.60661C11.7287 8.75071 11.7139 8.89988 11.658 9.03564C11.6021 9.17139 11.5076 9.28775 11.3861 9.37029C11.2647 9.45284 11.1218 9.49794 10.975 9.5H10.75Z" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
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
    await this.lumbering(ctx, apps.miskoKirtimai);
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
      await ctx.call('integrations.fishStockings.getData', {
        limit: process.env.NODE_ENV === 'local' ? 100 : 0,
      });
    }
  }

  @Method
  async lumbering(ctx: Context, appsIds: App['id'][]) {
    await this.broker.waitForServices(['integrations.fishStockings', 'events']);

    const count: number = await ctx.call('events.count', {
      query: { app: { $in: appsIds } },
    });

    if (!count) {
      await ctx.call('integrations.lumbering.getData', {
        limit: process.env.NODE_ENV === 'local' ? 100 : 0,
        initial: true,
      });
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
