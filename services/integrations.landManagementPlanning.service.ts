'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Method, Service } from 'moleculer-decorators';
import wkx from 'wkx';
import { App, APP_KEYS } from './apps.service';
//@ts-ignore
import Cron from '@r2d2bzh/moleculer-cron';
import * as turf from '@turf/turf';
import { isSameWeek } from 'date-fns';
import { Feature } from 'geojsonjs';
import puppeteer, { Browser, Page } from 'puppeteer';
import { IntegrationsMixin } from '../mixins/integrations.mixin';
import { parcelsSearch } from '../utils/boundaries';
import { Event, toEventBodyMarkdown } from './events.service';

interface LandManagementPlanning {
  startAt: string;
  serviceNo: string;
  name: string;
  municipality: string;
  externalId: string;
  status: string;
  geom: any;
}

@Service({
  name: 'integrations.landManagementPlanning',
  settings: {
    baseUrl: 'https://www.zpdris.lt/zpdris/jsf/index.jsf',
  },
  mixins: [Cron, IntegrationsMixin()],
  crons: [
    {
      name: 'integrationsLandManagementPlanning',
      cronTime: '0 5 * * *',
      timeZone: 'Europe/Vilnius',
      async onTick() {
        await this.call('integrations.landManagementPlanning.getData', {
          initial: false,
        });
      },
    },
  ],
})
export default class IntegrationsLandManagementPlanningService extends moleculer.Service {
  @Action({
    timeout: 0,
    params: {
      limit: { type: 'number', optional: true, default: 0 },
    },
  })
  async getData(ctx: Context<{ limit: number; initial: boolean }>) {
    this.startIntegration();

    const { limit, initial } = ctx.params;

    const app: App = await ctx.call('apps.findOne', {
      query: { key: APP_KEYS.zemetvarkosPlanavimas },
    });

    if (!app?.id) return;

    const data = await this.scrapeData(this.settings.baseUrl, initial, limit);
    const uniqueCadastralNumbers = [...new Set(data.flatMap((item) => item.cadastralNumbers))];
    const geomMap = await this.getGeometryData(uniqueCadastralNumbers);

    const dataWithGeom: LandManagementPlanning[] = data.reduce(
      (acc: LandManagementPlanning[], item) => {
        const geometries = item.cadastralNumbers
          .map((cadastralNumber: string) => geomMap.get(cadastralNumber))
          .filter((data: Feature) => data && data.geometry);

        if (geometries.length === 0) return acc;

        const combinedGeometry =
          geometries.length > 1
            ? turf.union(turf.featureCollection([...geometries]))
            : geometries[0];

        combinedGeometry.geometry.crs = 'EPSG:4326';

        acc.push({ ...item, geom: combinedGeometry });
        return acc;
      },
      [],
    );

    for (const entry of dataWithGeom) {
      const bodyJSON = [
        { title: 'Būsena', value: entry?.status || '-' },
        { title: 'Paslaugos numeris', value: entry?.serviceNo || '-' },
      ];

      const event: Partial<Event> = {
        name: entry.name,
        body: toEventBodyMarkdown(bodyJSON),
        startAt: new Date(entry.startAt),
        geom: entry.geom,
        app: app.id,
        isFullDay: true,
        externalId: entry.externalId,
      };

      await this.createOrUpdateEvent(ctx, app, event, !!initial);
    }

    return this.finishIntegration();
  }

  @Method
  async waitLoader(page: Page) {
    const waitIndicatorSelector = '#j_idt27_title';
    await page.waitForSelector(waitIndicatorSelector, { visible: true, timeout: 3000 });
    await page.waitForSelector(waitIndicatorSelector, { hidden: true });
  }

  @Method
  async navigateToNextPage(page: Page): Promise<boolean> {
    const nextButtonSelector = 'a.ui-paginator-next';

    await page.waitForSelector(nextButtonSelector, { timeout: 2000 });
    const isDisabled = await page.evaluate((selector) => {
      const nextButton = document.querySelector(selector);
      return nextButton && nextButton.classList.contains('ui-state-disabled');
    }, nextButtonSelector);

    if (isDisabled) return false;

    await page.click(nextButtonSelector);
    await this.waitLoader(page);

    return true;
  }

  @Method
  async getBrowser(): Promise<Browser> {
    return await puppeteer.connect({
      browserWSEndpoint: process.env.CHROME_WS_ENDPOINT || 'ws://localhost:9321',
      acceptInsecureCerts: true,
    });
  }

  @Method
  async getGeometryData(cadastralNumbers: string[]): Promise<Map<string, Feature>> {
    const geomMap = new Map();
    const chunkSize = 100;

    try {
      for (let i = 0; i < cadastralNumbers.length; i += chunkSize) {
        const chunk = cadastralNumbers.slice(i, i + chunkSize);
        const filters = chunk.map((cadastralNumber) => ({
          parcels: { cadastral_number: { exact: cadastralNumber } },
        }));

        const data = await parcelsSearch({
          requestBody: { filters },
          size: chunkSize,
          srid: 4326,
        });

        data.items.forEach((item) => {
          const geometry = wkx.Geometry.parse(item?.geometry?.data).toGeoJSON();

          const geom = {
            geometry,
            type: 'Feature',
          };
          geomMap.set(item?.cadastral_number, geom);
        });
      }
    } catch (error) {
      console.error('Error fetching geometry data:', error);
    }
    return geomMap;
  }

  @Method
  async scrapeData(url: string, initial: boolean, limit: number) {
    const maxRetries = 3;

    let browser;
    let retries = 0;
    while (retries < maxRetries) {
      try {
        browser = await this.getBrowser();
        if (!browser) return [];
        break;
      } catch (error) {
        retries++;
      }
    }

    const page = await browser.newPage();
    retries = 0;
    while (retries < maxRetries) {
      try {
        await page.goto(url, { waitUntil: 'networkidle0' });
        break;
      } catch (error) {
        retries++;
      }
    }

    const selectSelector = '#mainform\\:docs\\:j_id17';
    retries = 0;
    while (retries < maxRetries) {
      try {
        await page.waitForSelector(selectSelector);
        await page.select(selectSelector, '100');
        break;
      } catch (error) {
        retries++;
      }
    }

    retries = 0;
    while (retries < maxRetries) {
      try {
        await this.waitLoader(page);
        break;
      } catch (error) {
        retries++;
      }
    }

    const data: any[] = [];
    let hasNextPage = true;
    while (hasNextPage) {
      retries = 0;
      let itemsData;
      while (retries < maxRetries) {
        try {
          itemsData = await page.evaluate(async () => {
            async function generateExternalId(
              item: LandManagementPlanning & { cadastralNumbers: string[] },
            ) {
              const inputString = item.startAt + item.serviceNo + item.cadastralNumbers.toString();
              const buffer = new TextEncoder().encode(inputString);
              const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
              const hashArray = Array.from(new Uint8Array(hashBuffer));
              return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
            }

            const items = document.querySelectorAll('#mainform\\:docs_data > tr');
            const cadastralNumberPattern = /\d+\/\d+:\d+/g;

            const data = [];
            for (const itemElement of items) {
              const values = itemElement.querySelectorAll('td');
              const matches = values[2]?.innerText?.match(cadastralNumberPattern);

              if (!matches?.length) continue;

              const item: any = { cadastralNumbers: matches };

              ['startAt', 'serviceNo', 'name', 'municipality', 'status'].forEach((label, index) => {
                item[label] = values[index]?.innerText?.trim() || null;
              });

              item.externalId = await generateExternalId(item);
              data.push(item);
            }

            return data;
          });
          break;
        } catch (error) {
          retries++;
        }
      }

      if (limit) {
        data.push(...itemsData);
        if (data.length >= limit) break;
      } else if (!initial) {
        data.push(...itemsData);
        const allItemsInSameWeek = itemsData.every((item) =>
          isSameWeek(new Date(item.startAt), new Date()),
        );

        if (!allItemsInSameWeek) break;
      } else {
        data.push(...itemsData);
      }

      retries = 0;
      while (retries < maxRetries) {
        try {
          hasNextPage = await this.navigateToNextPage(page);
          break;
        } catch (error) {
          retries++;
          if (retries === maxRetries) hasNextPage = false;
        }
      }
    }

    await browser.close();
    return data;
  }
}
