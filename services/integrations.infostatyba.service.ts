'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Method, Service } from 'moleculer-decorators';
import { Event, toEventBodyMarkdown } from './events.service';
import { APP_KEYS, App } from './apps.service';
import { AddressesSearchFilterRequest } from '../utils/boundaries';

// @ts-ignore
import Cron from '@r2d2bzh/moleculer-cron';
import { IntegrationsMixin, IntegrationStats } from '../mixins/integrations.mixin';
import { wktToGeoJSON } from 'betterknown';
import { addressesSearch } from '../utils/boundaries';
import _ from 'lodash';

@Service({
  name: 'integrations.infostatyba',
  settings: {
    baseUrl: 'https://get.data.gov.lt',
  },

  mixins: [Cron, IntegrationsMixin()],

  crons: [
    {
      name: 'integrationsInfostatyba',
      cronTime: '0 7 * * *',
      timeZone: 'Europe/Vilnius',

      async onTick() {
        await this.call('integrations.infostatyba.getData', {
          limit: process.env.NODE_ENV === 'local' ? 100 : 0,
        });
      },
    },
  ],
})
export default class IntegrationsInfostatybaService extends moleculer.Service {
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
    const { limit } = ctx.params;

    type InfostatybaIntegrationStats = {
      invalid: {
        no_geom: number;
        no_date: number;
      };
    };

    const stats: IntegrationStats & InfostatybaIntegrationStats = this.startIntegration();

    // Additional props
    stats.invalid.no_date = 0;
    stats.invalid.no_geom = 0;

    const { dokTypes, appByDokType } = await this.getDokTypesData(ctx);
    const dokTipasQuery = dokTypes.map((i) => `dok_tipo_kodas="${i}"`).join('|');

    const query = [
      `limit(${limit || '1000'})`,
      'sort(_id)',
      `(${dokTipasQuery})`,
      'dok_statusas="Galiojantis"',
      'dokumento_reg_data!=null',
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

      response._data = await this.resolveAddresses(ctx, response._data);

      for (let entry of response._data) {
        skipParamString = `&_id>'${entry._id}'`;

        if (!entry.dokumento_reg_data) {
          this.addTotal();
          this.addInvalid();
          stats.invalid.no_date++;
          continue;
        }

        let geom;
        if (entry.address?.geom) {
          geom = entry.address.geom;
        }

        if (!geom) {
          this.addTotal();
          this.addInvalid();
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

        await this.createOrUpdateEvent(ctx, currentApp, event, !!ctx.params.initial);

        if (limit && stats.valid.total >= limit) {
          return this.finishIntegration();
        }
      }
    } while (response?._data?.length);

    return this.finishIntegration();
  }

  @Method
  async resolveAddresses(ctx: Context, items: any[]) {
    const statinioIdQuery = items
      .map((i) => i.statinio_id)
      .map((i) => `statinio_id="${i}"`)
      .join('|');
    const query = [`(${statinioIdQuery})`].map((i) => encodeURIComponent(i)).join('&');

    const url =
      this.settings.baseUrl + '/datasets/gov/vtpsi/infostatyba/Adresas/:format/json?' + query;

    const infoStatybaResponse: any = await ctx.call(
      'http.get',
      { url, opt: { responseType: 'json' } },
      { timeout: 0 },
    );

    type StreetCodeWithPlotOrBuildingNumber = {
      streetCode: number;
      plotOrBuildingNumber: string;
    };

    const filterItems: Array<any> = infoStatybaResponse._data.filter(
      (response: any) => response?.gat_kodas && response?.pastatas,
    );
    const infoStatybaResponseLookup = new Map<string, any>(
      filterItems.map((response: any) => [
        JSON.stringify(<StreetCodeWithPlotOrBuildingNumber>{
          streetCode: parseInt(response.gat_kodas),
          plotOrBuildingNumber: response.pastatas,
        }),
        response,
      ]),
    );

    const chunkecFilterItems = _.chunk(filterItems, 100);

    const geomLookupByStatinioId = new Map<string, any>();
    for (const index in chunkecFilterItems) {
      const addressesSearchFilters = chunkecFilterItems[index].map(
        (item) =>
          <AddressesSearchFilterRequest>{
            streets: {
              codes: [item.gat_kodas],
            },
            addresses: {
              plot_or_building_number: {
                exact: item.pastatas,
              },
            },
          },
      );

      const data = await addressesSearch({
        requestBody: {
          filters: addressesSearchFilters,
        },
        size: 100,
        srid: 4326,
      });

      data.items.forEach((address) => {
        const geom: any = wktToGeoJSON(address.geometry.data);
        geom.crs = 'EPSG:4326';

        const resp = infoStatybaResponseLookup.get(
          JSON.stringify(<StreetCodeWithPlotOrBuildingNumber>{
            streetCode: address.street.code,
            plotOrBuildingNumber: address.plot_or_building_number,
          }),
        );

        geomLookupByStatinioId.set(resp.statinio_id, {
          ...address,
          geom: {
            type: 'FeatureCollection',
            features: [{ geometry: geom, type: 'Feature' }],
          },
        });
      });
    }

    return items.map((item) => {
      return {
        ...item,
        address: geomLookupByStatinioId.get(item.statinio_id),
      };
    });
  }

  @Method
  async getDokTypesData(ctx: Context) {
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
