'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Method, Service } from 'moleculer-decorators';
import { Event, toEventBodyMarkdown } from './events.service';
import { parse } from 'geojsonjs';
import { APP_KEYS, App } from './apps.service';

// @ts-ignore
import Cron from '@r2d2bzh/moleculer-cron';
import { IntegrationsMixin } from '../mixins/integrations.mixin';

@Service({
  name: 'datagov',
  settings: {
    baseUrl: 'https://get.data.gov.lt',
  },

  mixins: [Cron, IntegrationsMixin()],

  crons: [
    {
      name: 'infostatyba',
      cronTime: '0 7 * * *',
      timeZone: 'Europe/Vilnius',

      async onTick() {
        await this.call('datagov.infostatyba', {
          limit: process.env.NODE_ENV === 'local' ? 100 : 0,
        });
      },
    },
  ],
})
export default class DatagovService extends moleculer.Service {
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
  async infostatyba(ctx: Context<{ limit: number; initial: boolean }>) {
    const { limit } = ctx.params;

    const stats = {
      total: 0,
      valid: {
        total: 0,
        inserted: 0,
        updated: 0,
      },
      invalid: {
        total: 0,
        no_date: 0,
        no_geom: 0,
      },
    };

    const { dokTypes, appByDokType } = await this.getInfostatybaDokTypesData(ctx);
    const dokTipasQuery = dokTypes.map((i) => `dok_tipo_kodas="${i}"`).join('|');

    const query = [
      'limit(1000)',
      'sort(_id)',
      `(${dokTipasQuery})`,
      'dok_statusas="Galiojantis"',
      'dokumento_reg_data!=null',
      'taskas_wgs!=null',
      'taskas_lks!=null',
      'dokumento_reg_data>"2021-11-01"',
    ]
      .map((i) => encodeURIComponent(i))
      .join('&');

    const url =
      this.settings.baseUrl + '/datasets/gov/vtpsi/infostatyba/Statinys/:format/json?' + query;

    let skipParamString = '';
    let response: any;
    do {
      response = await ctx.call(
        'http.get',
        {
          url: `${url}${skipParamString}`,
          opt: { responseType: 'json' },
        },
        {
          timeout: 0,
        },
      );

      for (let entry of response._data) {
        skipParamString = `&_id>'${entry._id}'`;
        stats.total++;

        if (!entry.dokumento_reg_data) {
          stats.invalid.total++;
          stats.invalid.no_date++;
          continue;
        }

        const matches = entry.taskas_lks.match(/\(([\d]+[\.[\d]+]?) ([\d]+[\.[\d]+]?)\)/);
        let geom;
        if (matches?.length) {
          geom = parse({
            type: 'Point',
            coordinates: [Number(matches[2]), Number(matches[1])],
          });
        }

        if (!geom) {
          stats.invalid.total++;
          stats.invalid.no_geom++;
          continue;
        }

        const bodyJSON = [
          { title: 'Projekto pavadinimas', value: entry.projekto_pavadinimas },
          { title: 'Adresas', value: entry.adresas },
          { title: 'Statinio kategorija', value: entry.statinio_kategorija || '-' },
          { title: 'Statybos rūšis', value: entry.statybos_rusis || '-' },
          { title: 'Statinio pavadinimas', value: entry.statinio_pavadinimas || '-' },
        ];

        const currentApp = appByDokType[entry.dok_tipo_kodas];

        const tagsIds: number[] = await this.findOrCreateTags(
          ctx,
          [entry.statybos_rusis],
          currentApp.key,
        );

        const event: Partial<Event> = {
          name: `${entry.statinio_pavadinimas}, ${entry.adresas}`,
          body: toEventBodyMarkdown(bodyJSON),
          startAt: new Date(entry.dokumento_reg_data),
          geom,
          app: currentApp.id,
          isFullDay: true,
          externalId: entry._id,
          tags: tagsIds,
        };

        if (entry.uuid) {
          event.url = `https://infostatyba.planuojustatau.lt/eInfostatyba-external/projectObject/projectObjectMain?uuid=${entry.uuid}`;
        }

        if (ctx.params.initial) {
          event.createdAt = event.startAt;
        }

        stats.valid.total++;

        const existingEvent: Event = await ctx.call('events.findOne', {
          query: {
            externalId: event.externalId,
            app: currentApp.id,
          },
        });

        if (existingEvent) {
          stats.valid.updated++;
          await ctx.call('events.update', {
            id: existingEvent.id,
            ...event,
          });
        } else {
          stats.valid.inserted++;
          await ctx.call('events.create', event);
        }

        if (limit && stats.valid.total >= limit) {
          return stats;
        }
      }
    } while (response?._data?.length);

    this.broker.emit('integrations.sync.finished');
    return stats;
  }

  @Method
  async getInfostatybaDokTypesData(ctx: Context) {
    const dokTypesByAppKey = {
      [APP_KEYS.infostatybaNaujas]: ['LSNS', 'SLRTV', 'SLRIE', 'SLRKS', 'SSIYV', 'SBEOS', 'SNSPJ'],
      [APP_KEYS.infostatybaRemontas]: [
        'LSKR',
        'KRBES',
        'LSPR',
        'LRS',
        'LAP',
        'RLRTV',
        'RLRIE',
        'RLRKS',
        'RSIYV',
        'RBEOS',
      ],
      [APP_KEYS.infostatybaGriovimas]: ['LGS', 'GBEOS'],
      [APP_KEYS.infostatybaPaskirtiesKeitimas]: ['LPSP'],
    };

    const appByKey: { [key: string]: App } = await ctx.call('apps.find', {
      query: {
        key: { $in: Object.keys(dokTypesByAppKey) },
      },
      mapping: 'key',
    });

    const appByDokType = Object.entries(dokTypesByAppKey).reduce(
      (acc: any, [appKey, dokTypes]: any[]) => {
        dokTypes?.forEach((dokType: string) => {
          acc[dokType] = appByKey[appKey];
        });
        return acc;
      },
      {},
    );

    return {
      dokTypes: Object.values(dokTypesByAppKey).flat(),
      appByDokType,
    };
  }
}
