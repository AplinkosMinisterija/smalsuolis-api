'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
import wkx from 'wkx';
import { App, APP_KEYS } from './apps.service';
//@ts-ignore
import Cron from '@r2d2bzh/moleculer-cron';
import { isSameDay, subDays } from 'date-fns';
import { Feature } from 'geojsonjs';
import puppeteer, { Browser, Page } from 'puppeteer';
import { IntegrationsMixin } from '../mixins/integrations.mixin';
import { parcelsSearch } from '../utils/boundaries';
import { Event, toEventBodyMarkdown } from './events.service';

export interface LandManagementPlanning {
  startAt: string;
  serviceNo: string;
  name: string;
  municipality: string;
  externalId: string;
  status: string;
  geom: any;
}

export interface GeometryResponse {
  items: {
    unique_number: number;
    cadastral_number: string;
    updated_at: string;
    area_ha: number;
    geometry: { srid: number; data: string };
  }[];
  total: number;
  current_page: string;
  current_page_backwards: string;
  previous_page: string;
  next_page: string;
}

const isYesterday = (date: Date) => isSameDay(date, subDays(new Date(), 1));

const waitLoader = async (page: Page) => {
  const waitIndicatorSelector = '#j_idt27_title';
  await page.waitForSelector(waitIndicatorSelector, { visible: true });
  await page.waitForSelector(waitIndicatorSelector, { hidden: true });
};

const navigateToNextPage = async (page: Page): Promise<boolean> => {
  const nextButtonSelector = 'a.ui-paginator-next';
  try {
    await page.waitForSelector(nextButtonSelector, { timeout: 2000 });
    const isDisabled = await page.evaluate((selector) => {
      const nextButton = document.querySelector(selector);
      return nextButton && nextButton.classList.contains('ui-state-disabled');
    }, nextButtonSelector);

    if (isDisabled) return false;

    await page.click(nextButtonSelector);
    await waitLoader(page);
  } catch (error) {
    console.error('Navigation Error:', error);
    return false;
  }
  return true;
};

const getBrowser = async (): Promise<Browser | null> => {
  try {
    return await puppeteer.connect({
      browserWSEndpoint: process.env.CHROME_WS_ENDPOINT || 'ws://localhost:9321',
      acceptInsecureCerts: true,
    });
  } catch (error) {
    console.error('Browser Connection Error:', error);
    return null;
  }
};

const getGeometryData = async (cadastralNumbers: string[]): Promise<Map<string, Feature>> => {
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
      });

      data.items.forEach((item) => {
        const geometry = wkx.Geometry.parse(item?.geometry?.data).toGeoJSON();

        const geom = {
          geometry: geometry,
          type: 'Feature',
        };
        geomMap.set(item?.cadastral_number, geom);
      });
    }
  } catch (error) {
    console.error('Error fetching geometry data:', error);
  }
  return geomMap;
};

const scrapeData = async (url: string, initial: boolean, limit: number) => {
  const browser = await getBrowser();
  if (!browser) return [];

  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle0' });
  const selectSelector = '#mainform\\:docs\\:j_id17';
  await page.waitForSelector(selectSelector);
  await page.select(selectSelector, '100');
  await waitLoader(page);

  const data: any[] = [];
  let hasNextPage = true;

  while (hasNextPage) {
    const itemsData = await page.evaluate(() => {
      const items = document.querySelectorAll('#mainform\\:docs_data > tr');
      const cadastralNumberPattern = /\d+\/\d+:\d+/;

      const data = Array.from(items).reduce((acc, itemElement) => {
        const values = Array.from(itemElement.querySelectorAll('td'));
        const matches = values[2]?.innerText?.match(cadastralNumberPattern);

        if (!matches?.length) return acc;

        const item: any = { cadastralNumbers: matches };

        ['startAt', 'serviceNo', 'name', 'municipality', 'status'].forEach((label, index) => {
          item[label] = values[index]?.innerText.trim() || null;
        });

        item.externalId = btoa(
          encodeURIComponent(item.date + item.serviceNo + matches.toString()).replace(
            /%([0-9A-F]{2})/g,
            (_, p1) => String.fromCharCode(parseInt(p1, 16)),
          ),
        );

        acc.push(item);
        return acc;
      }, []);

      return data;
    });

    if (limit) {
      data.push(...itemsData);
      if (data.length >= limit) break;
    } else if (!initial) {
      const yesterdayItems = itemsData.filter((item) => isYesterday(new Date(item.startAt)));
      data.push(...yesterdayItems);
      if (yesterdayItems.length !== itemsData.length) break;
    } else {
      data.push(...itemsData);
    }

    hasNextPage = await navigateToNextPage(page);
  }

  await browser.close();
  return data;
};

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

    const data = await scrapeData(this.settings.baseUrl, initial, limit);
    const uniqueCadastralNumbers = [...new Set(data.flatMap((item) => item.cadastralNumbers))];
    const geomMap = await getGeometryData(uniqueCadastralNumbers);

    const dataWithGeom: LandManagementPlanning[] = data.reduce(
      (acc: LandManagementPlanning[], item) => {
        const geometries = item.cadastralNumbers
          .map((cadastralNumber: string) => geomMap.get(cadastralNumber))
          .filter((data: Feature) => data && data.geometry);

        if (geometries.length === 0) return acc;

        const combinedGeometry =
          geometries.length > 1
            ? {
                type: `Multi${geometries[0]?.geometry?.type}`,
                coordinates: geometries.map((data: Feature) => data.geometry.coordinates),
              }
            : geometries[0].geometry;

        const featureCollection = {
          type: 'FeatureCollection',
          features: [{ type: 'Feature', geometry: combinedGeometry }],
        };

        acc.push({ ...item, geom: featureCollection });
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
}
