'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
import { Event } from './events.service';
import { parse } from 'geojsonjs';

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

    const response: any = await ctx.call('http.get', {
      url: `${url}?limit(2)`,
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
        endAt: new Date(entry.iraso_data),
        geom,
        externalId: entry._id,
      };

      await ctx.call('events.create', event);

      console.log(event, matches);
    }
  }
}
