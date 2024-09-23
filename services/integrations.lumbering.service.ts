'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
import { App, APP_KEYS } from './apps.service';
// @ts-ignore
import Cron from '@r2d2bzh/moleculer-cron';
import unzipper from 'unzipper';
import stream from 'node:stream';

import { Event, toEventBodyMarkdown } from './events.service';
import { IntegrationsMixin, IntegrationStats } from '../mixins/integrations.mixin';

@Service({
  name: 'integrations.lumbering',
  settings: {
    zipUrl: 'https://lkmp.alisas.lt/static/lkmp-data.geojson.zip',
  },
  mixins: [Cron, IntegrationsMixin()],
  crons: [
    {
      name: 'integrationsLumbering',
      cronTime: '0 4 * * *',
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
    this.startIntegration();

    const app: App = await ctx.call('apps.findOne', {
      query: {
        key: APP_KEYS.miskoKirtimai,
      },
    });

    if (!app?.id) return;

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

    for (const feature of features) {
      feature.geometry.crs = 'EPSG:4326';

      const ownershipTypesByDigit: any = {
        1: 'Privati',
        2: 'Valstybinė',
        3: 'Privati',
      };
      const firstIdDigit = Number(`${feature.properties.id}`.slice(0, 1));

      const bodyJSON = [
        { title: 'Struktūrinis padalinys', value: `${feature.properties.padalinys} RP` },
        { title: 'Girininkija', value: `${feature.properties.girininkija} girininkija` },
        {
          title: 'Galioja',
          value: `${feature.properties.galioja_nuo} iki ${feature.properties.galioja_iki}`,
        },
        { title: 'Kvartalas', value: feature.properties.kvartalas },
        { title: 'Sklypas', value: feature.properties.sklypas },
        { title: 'Kertamas plotas', value: `${feature.properties.kertamas_plotas || '-'} ha` },
        { title: 'Kirtimo rūšis', value: feature.properties.kirtimo_rusis },
        { title: 'Vyraujantys medžiai', value: feature.properties.vyraujantys_medziai },
        { title: 'Atkūrimo būdas', value: feature.properties.atkurimo_budas },
        { title: 'Nuosavybės forma', value: ownershipTypesByDigit[firstIdDigit] || '-' },
      ];

      const tagsIds: number[] = await this.findOrCreateTags(
        ctx,
        [feature.properties.kirtimo_rusis],
        APP_KEYS.miskoKirtimai,
      );

      const tagsData = [];

      if (tagsIds.length && feature.properties.kertamas_plotas) {
        const area = Math.round(Number(feature.properties.kertamas_plotas) * 100) / 100;
        tagsData.push({
          id: tagsIds[0],
          name: 'area',
          value: area,
        });
      }

      const event: Partial<Event> = {
        name: `${feature.properties.kirtimo_rusis}, ${feature.properties.girininkija} girininkija, ${feature.properties.padalinys} r.p.`,
        body: toEventBodyMarkdown(bodyJSON),
        startAt: new Date(feature.properties.galioja_nuo),
        endAt: new Date(feature.properties.galioja_iki),
        geom: feature,
        app: app.id,
        isFullDay: true,
        externalId: feature.properties.id,
        tags: tagsIds,
        tagsData,
      };

      await this.createOrUpdateEvent(ctx, app, event, !!ctx.params.initial);
    }

    await this.cleanupInvalidEvents(ctx, app);

    return this.finishIntegration();
  }
}
