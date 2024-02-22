'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
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
    const app: App = await ctx.call('apps.findOne', {
      query: { key: 'infostatyba' },
    });

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

    const filter = [
      'limit(100)',
      'sort(_id)',
      'dok_tipo_kodas="SRA"', // only Statybos leidimai and approved
      'dok_statusas="Patenkintas"',
      'iraso_data!=null',
      'taskas_wgs!=null',
      'taskas_lks!=null',
    ].join('&');

    const url =
      this.settings.baseUrl + '/datasets/gov/vtpsi/infostatyba/Statinys/:format/json?' + filter;

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

        const matches = entry.taskas_lks.match(/\(([\d]*) ([\d]*)\)/);
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
          name: `${entry.dok_statusas} ${
            entry.dokumento_kategorija.charAt(0).toLowerCase() + entry.dokumento_kategorija.slice(1)
          }`,
          body: entry.iraso_paaiskinimas,
          startAt: new Date(entry.iraso_data),
          geom,
          app: app.id,
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
}
