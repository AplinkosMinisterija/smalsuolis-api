'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Method, Service } from 'moleculer-decorators';
import { APP_TYPES, App } from './apps.service';
// @ts-ignore
import Cron from '@r2d2bzh/moleculer-cron';
import unzipper from 'unzipper';
import stream from 'node:stream';

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
      const response: any = await ctx.call(
        'http.get',
        {
          url: this.settings.zipUrl,
          opt: { isStream: true },
        },
        {
          timeout: 0,
        },
      );

      const geojson = await new Promise(function (resolve) {
        response.pipe(unzipper.Parse()).pipe(
          new stream.Transform({
            objectMode: true,
            transform: async function (entry, e, cb) {
              const fileName = entry.path;
              const type = entry.type; // 'Directory' or 'File'

              if (type === 'File' && fileName === 'lkmp-data.geojson') {
                const chunks: Buffer[] = [];

                entry.on('data', function (chunk: Buffer) {
                  chunks.push(chunk);
                });

                // Send the buffer or you can put it into a var
                entry.on('end', function () {
                  const jsonString = Buffer.concat(chunks).toString('utf-8');
                  const geojson = JSON.parse(jsonString);
                  resolve(geojson);
                });
              }

              cb();
            },
          }),
        );
      });

      console.log(geojson);
    }

    this.broker.emit('tiles.events.renew');
    return stats;
  }
}
