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
  settings: {
    baseUrl: 'https://get.data.gov.lt',
  },
})
export default class DatagovService extends moleculer.Service {
  @Action()
  async infostatyba(ctx: Context) {
    const url =
      this.settings.baseUrl +
      '/datasets/gov/vtpsi/infostatyba/Statinys/:format/json';

    console.log(url);
    const response: any = await ctx.call('http.get', {
      url: `${url}?limit(9)`,
      opt: { responseType: 'json' },
    });

    // TODO: skip by doktype

    for (let entry of response._data) {
      const matches = entry.taskas_lks.match(/\(([\d]*) ([\d]*)\)/);
      let geom;
      if (matches) {
        geom = parse({
          type: 'Point',
          coordinates: [matches[1], matches[2]],
        });
      }

      if (!geom) continue;

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

      //      await ctx.call('events.create', event);

      console.log(event);
    }
  }

  @Method
  async getEventName() {}
}
