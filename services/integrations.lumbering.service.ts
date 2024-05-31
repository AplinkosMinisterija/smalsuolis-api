'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
import { APP_TYPES, App } from './apps.service';
// @ts-ignore
import Cron from '@r2d2bzh/moleculer-cron';

@Service({
  name: 'integrations.lumbering',
  settings: {
    zipUrl: 'https://lkmp.alisas.lt/static/lkmp-data.geojson.zip',
  },
  mixins: [Cron],
  crons: [
    {
      name: 'integrationsLumbering',
      cronTime: '0 12 * * *',
      timeZone: 'Europe/Vilnius',
      async onTick() {
        await this.call('integrations.lumbering.getData', {
          limit: process.env.NODE_ENV === 'local' ? 100 : 0,
        });
      },
    },
  ],
})
export default class IntegrationsLumberingStockingsService extends moleculer.Service {
  @Action({
    timeout: 0,
    params: {
      limit: {
        type: 'number',
        optional: true,
        default: 0,
      },
    },
  })
  async getData(ctx: Context<{ limit: number }>) {
    const stats = {
      total: 0,
      valid: {
        total: 0,
        inserted: 0,
        updated: 0,
      },
      invalid: {
        total: 0,
      },
    };

    const app: App = await ctx.call('apps.findOne', {
      query: {
        key: APP_TYPES.miskoKirtimai,
      },
    });

    if (app?.id) {
      console.log('done');
    }

    this.broker.emit('tiles.events.renew');
    return stats;
  }
}
