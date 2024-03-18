'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Method, Service } from 'moleculer-decorators';
import { Event } from './events.service';
import { parse } from 'geojsonjs';
import { App } from './apps.service';

// @ts-ignore
import Cron from '@r2d2bzh/moleculer-cron';

@Service({
  name: 'datagov',
  settings: {
    baseUrl: 'https://get.data.gov.lt',
  },

  mixins: [Cron],

  crons: [
    {
      name: 'infostatyba',
      cronTime: '0 3 * * *',
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
    },
  })
  async infostatyba(ctx: Context<{ limit: number }>) {
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

    const { dokTypes, appIdByDokType } = await this.getInfostatybaDokTypesData(ctx);
    const dokTipasQuery = dokTypes.map((i) => `dok_tipo_kodas="${i}"`).join('|');

    const query = [
      'limit(1000)',
      'sort(_id)',
      `(${dokTipasQuery})`,
      'dok_statusas="Galiojantis"',
      'iraso_data!=null',
      'taskas_wgs!=null',
      'taskas_lks!=null',
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

        if (!entry.iraso_data) {
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

        const event: Partial<Event> = {
          name: entry.projekto_pavadinimas,
          body: [
            `**Projekto pavadinimas:** ${entry.projekto_pavadinimas}`,
            `**Adresas:** ${entry.adresas}`,
            `**Statinio kategorija:** ${entry.statinio_kategorija?.toLowerCase?.() || '-'}`,
            `**Statybos rūšis:** ${entry.statybos_rusis?.toLowerCase?.() || '-'}`,
            `**Statinio pavadinimas:** ${entry.statinio_pavadinimas?.toLowerCase?.() || '-'}`,
          ].join('\n\n'),
          startAt: new Date(entry.iraso_data),
          geom,
          app: appIdByDokType[entry.dok_tipo_kodas],
          isFullDay: true,
          externalId: entry._id,
        };

        stats.valid.total++;

        const existingEvent: Event = await ctx.call('events.findOne', {
          query: {
            externalId: event.externalId,
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

    return stats;
  }

  @Method
  async getInfostatybaDokTypesData(ctx: Context) {
    const dokTypesByAppKey = {
      'infostatyba-naujas': ['LSNS', 'SLRTV', 'SLRIE', 'SLRKS', 'SSIYV', 'SBEOS', 'SNSPJ'],
      'infostatyba-remontas': [
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
      'infostatyba-griovimas': ['LGS', 'GBEOS'],
      'infostatyba-paskirties-keitimas': ['LPSP'],
    };

    const appIdByKey: { [key: string]: App['id'] } = await ctx.call('apps.find', {
      query: {
        key: { $in: Object.keys(dokTypesByAppKey) },
      },
      mapping: 'key',
      mappingField: 'id',
    });

    const appIdByDokType = Object.entries(dokTypesByAppKey).reduce(
      (acc: any, [appKey, dokTypes]: any[]) => {
        dokTypes?.forEach((dokType: string) => {
          acc[dokType] = appIdByKey[appKey];
        });
        return acc;
      },
      {},
    );

    return {
      dokTypes: Object.values(dokTypesByAppKey).flat(),
      appIdByDokType,
    };
  }
}
