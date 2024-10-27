'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
import { App, APP_KEYS } from './apps.service';

// @ts-ignore
import Cron from '@r2d2bzh/moleculer-cron';
import { IntegrationsMixin } from '../mixins/integrations.mixin';

import { format, isSameDay, subDays } from 'date-fns'; // Import date-fns functions
import puppeteer, { Page } from 'puppeteer';
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

const isYesterday = (date: string) => {
  const yesterday = subDays(new Date(), 1);
  return isSameDay(date, yesterday);
};

const waitLoader = async (page: Page) => {
  const waitIndicatorSelector = '#j_idt27_title';

  await page.waitForSelector(waitIndicatorSelector, { visible: true });
  await page.waitForSelector(waitIndicatorSelector, { hidden: true });
};

const navigateToNextPage = async (page: Page) => {
  const nextButtonSelector = 'a.ui-paginator-next';

  try {
    await page.waitForSelector(nextButtonSelector, { timeout: 2000 });

    const isDisabled = await page.evaluate((selector) => {
      const nextButton = document.querySelector(selector);
      return nextButton && nextButton.classList.contains('ui-state-disabled');
    }, nextButtonSelector);

    if (isDisabled) {
      return false;
    }

    await page.click(nextButtonSelector);

    await waitLoader(page);
  } catch {}

  return true;
};

const scrapeData = async (page: Page, initial: boolean) => {
  const data = [];
  let hasNextPage = true;

  while (hasNextPage) {
    const itemsData = await page?.evaluate(() => {
      const items = document.querySelectorAll('#mainform\\:docs_data > tr');
      const cadastralNumberPattern = /\d+\/\d+:\d+/;
      const data = [];

      for (const itemElement of items) {
        const values = Array.from(itemElement.querySelectorAll('td'));
        const matches = values[2]?.innerText?.match(cadastralNumberPattern);

        if (matches?.length) {
          const item: any = { cadastralNumbers: matches };

          ['startAt', 'serviceNo', 'name', 'municipality', 'status'].forEach((label, index) => {
            item[label] = values[index]?.innerText.trim() || null;
          });

          const plainExternalId = item.date + item.serviceNo + matches.toString();

          item.externalId = btoa(
            encodeURIComponent(plainExternalId).replace(/%([0-9A-F]{2})/g, (_, p1) =>
              String.fromCharCode(parseInt(p1, 16)),
            ),
          );

          data.push(item);
        }
      }

      return data;
    });

    if (!initial) {
      const yesterdayItems = itemsData.filter((item) =>
        isYesterday(format(new Date(item.date), 'yyyy-MM-dd')),
      );
      data.push(...yesterdayItems);

      if (yesterdayItems.length !== itemsData.length) break;
    } else {
      data.push(...itemsData);
    }

    hasNextPage = await navigateToNextPage(page);
  }

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
      cronTime: '0 3 * * *',
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
    this.startIntegration();

    const app: App = await ctx.call('apps.findOne', {
      query: {
        key: APP_KEYS.zemetvarkosPlanavimas,
      },
    });

    if (!app?.id) return;

    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    await page.goto(this.settings.baseUrl, {
      waitUntil: 'networkidle0',
    });

    const selectSelector = '#mainform\\:docs\\:j_id17';

    await page.waitForSelector(selectSelector);
    await page.select(selectSelector, '100');
    await waitLoader(page);

    const data = await scrapeData(page, ctx.params.initial);

    await browser.close();

    //const uniqueCadastralNumbers = [...new Set(data.flatMap((item) => item.cadastralNumbers))];
    // const geomMap = await fetchGeometryData(uniqueCadastralNumbers);
    const geomMap = new Map();
    const dataWithGeom: LandManagementPlanning[] = data.map((item) => ({
      ...item,
      geom: item.cadastralNumbers
        .map((cadastralNumber: string) => geomMap.get(cadastralNumber))
        .filter(Boolean),
    }));

    for (let entry of dataWithGeom) {
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
        isFullDay: false,
        externalId: entry.externalId,
      };

      await this.createOrUpdateEvent(ctx, app, event, !!ctx.params.initial);
    }

    await this.cleanupInvalidEvents(ctx, app);

    return this.finishIntegration();
  }
}
