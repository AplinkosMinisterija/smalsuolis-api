'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Method, Service } from 'moleculer-decorators';
import { Event } from './events.service';
import { parse } from 'geojsonjs';

interface InfostatybaEntry {
  _type: string;
  _id: string;
  _revision: string;
  _base: null;
  id: string;
  projekto_id: string;
  statinio_id: string;
  projekto_pavadinimas: string;
  projekto_reg_nr: string;
  projekto_metai: number;
  unikalus_numeris: string;
  statinio_kategorija: string;
  adresas: string;
  statybos_rusis: string;
  statinio_pavadinimas: string;
  pastatymo_metai: number;
  kadastro_nr: string;
  ploto_reg_tipas: string;
  sklypo_reg_statusas: null;
  dokumento_reg_nr: string;
  dokumento_reg_data: string;
  iraso_paaiskinimas: string;
  iraso_data: string;
  dok_statusas: string;
  dok_tipo_kodas: string;
  dokumento_kategorija: string;
  dok_irasas: string;
  taskas_lks: string;
  taskas_wgs: string;
}

@Service({
  name: 'datagov',
  timeout: 0,
  settings: {
    baseUrl: 'https://get.data.gov.lt',
  },
})
export default class DatagovService extends moleculer.Service {
  @Action()
  async infostatyba(ctx: Context) {
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
        wrong_dok_type: 0,
      },
    };

    const dokType = [
      'SRA',
      'ARCCR',
      'RCCR',
      'PNSSP',
      'PNUR',
      'ANN',
      'PSR',
      'PSP',
      'BCPPA',
      'LSNS',
      'TLDR',
      'BIPA',
      'ISP',
      'LRS',
      'LAP',
    ];

    const url =
      this.settings.baseUrl +
      '/datasets/gov/vtpsi/infostatyba/Statinys/:format/json?limit(100)';

    let skipParamString = '';
    let response: any;
    do {
      response = await ctx.call('http.get', {
        url: `${url}${skipParamString}`,
        opt: { responseType: 'json' },
      });

      for (let entry of response._data) {
        skipParamString = `&_id>'${entry._id}'`;
        stats.total++;

        if (!entry.iraso_data) {
          stats.invalid.total++;
          stats.invalid.no_date++;
          continue;
        }

        if (!dokType.includes(entry.dok_tipo_kodas)) {
          stats.invalid.total++;
          stats.invalid.wrong_dok_type++;
          continue;
        }

        const matches = entry.taskas_lks.match(/\(([\d]*) ([\d]*)\)/);
        let geom;
        if (matches) {
          geom = parse({
            type: 'Point',
            coordinates: [matches[1], matches[2]],
          });

          if (geom?.features?.[0]?.geometry) {
            (geom.features[0].geometry as any).crs = {
              type: 'name',
              properties: { name: 'EPSG:4326' },
            };
          }
        }

        if (!geom) {
          stats.invalid.total++;
          stats.invalid.no_geom++;
          continue;
        }

        const event: Partial<Event> = {
          name: `${entry.dok_statusas} ${
            entry.dokumento_kategorija.charAt(0).toLowerCase() +
            entry.dokumento_kategorija.slice(1)
          }`,
          body: entry.iraso_paaiskinimas,
          startAt: new Date(entry.iraso_data),
          geom,
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
      }
    } while (response?._data?.length);

    return stats;
  }

  @Method
  async getEventName() {}
}
