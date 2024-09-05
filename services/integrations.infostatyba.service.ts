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
import { formatDuration, intervalToDuration } from 'date-fns';

const addressCacheKey = 'integrations:infostatyba:addresses';
@Service({
  name: 'integrations.infostatyba',
  settings: {
    baseUrl: 'https://get.data.gov.lt',
  },

  mixins: [Cron, IntegrationsMixin()],

  crons: [
    {
      name: 'integrationsInfostatyba',
      cronTime: '0 12 * * *',
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
        not_applicable: number;
        no_address: number;
        no_address_building: number;
        no_geom: number;
        no_date: number;
      };
    };

    const stats: IntegrationStats & InfostatybaIntegrationStats = this.startIntegration();

    // Additional props
    stats.invalid.no_date = 0;
    stats.invalid.no_geom = 0;
    stats.invalid.no_address = 0;
    stats.invalid.no_address_building = 0;
    stats.invalid.not_applicable = 0;

    const { dokTypes, appByDokType, apps } = await this.getDokTypesData(ctx);
    const dokTipasQuery = dokTypes.map((i) => `dok_tipo_kodas="${i}"`).join('|');

    const query = [
      `limit(${limit || '1000'})`,
      `(${dokTipasQuery})`,
      'dok_statusas="Galiojantis"',
      'dokumento_reg_data!=null',
    ]
      .map((i) => encodeURIComponent(i))
      .join('&');

    const url =
      this.settings.baseUrl + '/datasets/gov/vtpsi/infostatyba/Statinys/:format/json?' + query;

    let total = limit;
    if (!total) {
      total = await this.getCount(ctx, url);
    }
    /* 
      Since Statinys doesn't have relationship to addresses dataset we can go two ways:
      1. Fetch addresses for each batch (Statinys -> Filter addresses by statinys_id)
      2. Prefetch all addresses and then get from local cache (redis in this case)

      With the first approach each query (of 1K items with filters) takes ~10-30 seconds. 
      Without filtering each 10K elements takes ~4s (~15 mins total).

      So going with second approach we save a lot of time and effort.
    */
    await this.prefetchAndCacheAddresses(ctx);

    let skipParamString = '';
    const selectFieldsQueryStr =
      '&sort(_id)&select(_id,dok_tipo_kodas,dok_statusas,dokumento_reg_data,statinio_id,projekto_pavadinimas,adresas,statinio_kategorija,statybos_rusis,statinio_pavadinimas,uuid,_page)';

    let response: any;
    const startTime = new Date();
    do {
      response = await ctx.call(
        'http.get',
        {
          url: `${url}${selectFieldsQueryStr}${skipParamString}`,
          opt: { responseType: 'json' },
        },
        {
          timeout: 0,
        },
      );

      response._data = await this.resolveAddresses(ctx, response._data);
      // skipParamString = `&page("${response._page.next}")`; // TODO

      for (let entry of response._data) {
        // let's filter out what's not needed manually - it saves time.. // TODO
        skipParamString = `&_id>'${entry._id}'`;
        if (
          !dokTypes.includes(entry.dok_tipo_kodas) ||
          entry.dok_statusas !== 'Galiojantis' ||
          !entry.dokumento_reg_data
        ) {
          this.addTotal();
          this.addInvalid();
          stats.invalid.not_applicable++;
          continue;
        }

        if (!entry.dokumento_reg_data) {
          this.addTotal();
          this.addInvalid();
          stats.invalid.no_date++;
          continue;
        }

        if (!entry.address_data) {
          this.addTotal();
          this.addInvalid();
          stats.invalid.no_address++;
          continue;
        } else if (!entry.address_data.pastatas) {
          this.addTotal();
          this.addInvalid();
          stats.invalid.no_address_building++;
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
      const progress = this.calcProgression(stats.total, total, startTime);
      this.broker.logger.info(`Statiniai sync progress: ${progress.text}`);
    } while (response?._data?.length);

    await this.cleanupInvalidEvents(ctx, apps);

    return this.finishIntegration();
  }

  @Method
  async resolveAddresses(ctx: Context, items: any[]) {
    const addresses: any[] = [];

    for (let entry of items) {
      const data = await this.broker.cacher.get(`${addressCacheKey}:${entry.statinio_id}`);
      entry.address_data = data;
      addresses.push(data);
    }

    type StreetCodeWithPlotOrBuildingNumber = {
      streetCode: number;
      plotOrBuildingNumber: string;
    };

    const filterItems: Array<any> = addresses.filter(
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
  async getCount(ctx: Context, url: string) {
    const fullUrl = new URL(url);
    if (fullUrl.search) {
      url += '&';
    } else if (!url.endsWith('?')) {
      url += '?';
    }

    url += 'count()';

    const totalResponse: any = await ctx.call(
      'http.get',
      { url, opt: { responseType: 'json' } },
      { timeout: 0 },
    );

    return totalResponse?._data?.[0]?.['count()'];
  }

  @Method
  async prefetchAndCacheAddresses(ctx: Context) {
    const query = [`limit(5000)`, 'sort(_id)', 'select(_id,statinio_id,gat_kodas,pastatas)']
      .map((i) => encodeURIComponent(i))
      .join('&');

    const baseUrl = this.settings.baseUrl + '/datasets/gov/vtpsi/infostatyba/Adresas/:format/json';
    const url = `${baseUrl}?${query}`;

    const total = await this.getCount(ctx, baseUrl);
    let skipParamString = '';

    let response: any;
    const startTime = new Date();
    const oneDay = 60 * 60 * 24;

    const stats = {
      count: 0,
      total,
    };

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

      const items = response._data || [];

      stats.count += items.length;
      let promises = [];

      for (let entry of response._data) {
        skipParamString = `&_id>'${entry._id}'`;

        promises.push(
          this.broker.cacher.set(`${addressCacheKey}:${entry.statinio_id}`, entry, oneDay),
        );
      }

      await Promise.all(promises);

      const progress = this.calcProgression(stats.count, stats.total, startTime);
      this.broker.logger.info(`Address sync progress: ${progress.text}`);
    } while (response._data.length);
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
      apps: Object.values(appByKey),
      appByDokType,
    };
  }
}
