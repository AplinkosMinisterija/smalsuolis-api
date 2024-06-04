'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Method, Service } from 'moleculer-decorators';
import { APP_TYPES, App } from './apps.service';
// @ts-ignore
import Cron from '@r2d2bzh/moleculer-cron';
import unzipper from 'unzipper';
import stream from 'node:stream';

import pointOnFeature from '@turf/point-on-feature';
import transformation from 'transform-coordinates';
import { getFeatureCollection } from 'geojsonjs';
import { Event, toEventBodyMarkdown } from './events.service';

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
export default class IntegrationsLumberingService extends moleculer.Service {
  @Action({
    timeout: 0,
    params: {
      limit: {
        type: 'number',
        optional: true,
        default: 0,
      },
      initial: {
        type: 'boolean',
        optional: true,
        default: false,
      },
    },
  })
  async getData(ctx: Context<{ limit: number; initial: boolean }>) {
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

    if (!app?.id) {
      return;
    }

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

    const geojson: any = await new Promise(function (resolve) {
      response.pipe(unzipper.Parse()).pipe(
        new stream.Transform({
          objectMode: true,
          transform: async function (entry, _e, cb) {
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

    const features: any[] = ctx.params.limit
      ? geojson.features.splice(0, ctx.params.limit)
      : geojson.features;

    const transform = transformation('EPSG:4326', '3346');
    for (const feature of features) {
      const pointOnPolygon = pointOnFeature(feature);

      const transformedCoordinates = transform.forward([
        pointOnPolygon.geometry.coordinates[0],
        pointOnPolygon.geometry.coordinates[1],
      ]);

      const geom = getFeatureCollection({
        type: 'Point',
        coordinates: transformedCoordinates,
      });

      const bodyJSON = [
        { title: 'VĮ VMU padalinys', value: `${feature.properties.padalinys} RP` },
        { title: 'Girininkija', value: `${feature.properties.girininkija} girininkija` },
        {
          title: 'Galioja',
          value: `${feature.properties.galioja_nuo} iki ${feature.properties.galioja_iki}`,
        },
        { title: 'Kvartalas', value: feature.properties.kvartalas },
        { title: 'Sklypas', value: feature.properties.sklypas },
        { title: 'Kertamas plotas', value: feature.properties.kertamas_plotas },
        { title: 'Kirtimo rūšis', value: feature.properties.kirtimo_rusis },
        { title: 'Vyraujantys medžiai', value: feature.properties.vyraujantys_medziai },
        { title: 'Atkūrimo būdas', value: feature.properties.atkurimo_budas },
      ];

      const event: Partial<Event> = {
        name: `${feature.properties.kirtimo_rusis}, ${feature.properties.girininkija} girininkija, ${feature.properties.padalinys} r.p.`,
        body: toEventBodyMarkdown(bodyJSON),
        startAt: new Date(feature.properties.galioja_nuo),
        endAt: new Date(feature.properties.galioja_iki),
        geom,
        app: app.id,
        isFullDay: true,
        externalId: feature.properties.id,
      };

      if (ctx.params.initial) {
        event.createdAt = event.startAt;
      }

      stats.total++;

      if (!event.externalId) {
        stats.invalid.total++;
      } else {
        const existingEvent: Event = await ctx.call('events.findOne', {
          query: {
            externalId: event.externalId,
            app: app.id,
          },
        });

        if (existingEvent?.id) {
          await ctx.call('events.update', {
            id: Number(existingEvent.id),
            ...event,
          });
          stats.valid.total++;
          stats.valid.updated++;
        } else {
          await ctx.call('events.create', event);
          stats.valid.total++;
          stats.valid.inserted++;
        }
      }
    }

    this.broker.emit('tiles.events.renew');
    return stats;
  }
}
