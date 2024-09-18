'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
import { Event, toEventBodyMarkdown } from './events.service';
import { APP_KEYS, App } from './apps.service';
import transformation from 'transform-coordinates';

// @ts-ignore
import Cron from '@r2d2bzh/moleculer-cron';
import { getFeatureCollection } from 'geojsonjs';
import { IntegrationsMixin, IntegrationStats } from '../mixins/integrations.mixin';

const StatusLabels = {
  FINISHED: 'Įžuvinta',
  INSPECTED: 'Patikrinta',
  ONGOING: 'Vyksta dabar',
  UPCOMING: 'Suplanuota',
};

interface FishStocking {
  id: number;
  eventTime: string;
  location: {
    area: number;
    name: string;
    cadastral_id: string;
    municipality: {
      id: number;
      name: string;
    };
  };
  batches: {
    id: number;
    amount: number;
    weight: number;
    reviewAmount: number;
    reviewWeight: number;
    fishType: {
      id: number;
      label: string;
    };
    fishAge: {
      id: number;
      label: string;
    };
  }[];
  status: 'FINISHED' | 'INSPECTED' | 'UPCOMING' | 'ONGOING';
  coordinates: { x: number; y: number };
  geom: any;
}

@Service({
  name: 'integrations.fishStockings',
  settings: {
    baseUrl: 'https://zuvinimas.biip.lt',
  },
  mixins: [Cron, IntegrationsMixin()],
  crons: [
    {
      name: 'integrationsFishStockings',
      cronTime: '0 3 * * *',
      timeZone: 'Europe/Vilnius',
      async onTick() {
        await this.call('integrations.fishStockings.getData', {
          limit: process.env.NODE_ENV === 'local' ? 100 : 0,
        });
      },
    },
  ],
})
export default class IntegrationsFishStockingsService extends moleculer.Service {
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
        key: APP_KEYS.izuvinimas,
      },
    });

    if (!app?.id) return;

    const url =
      this.settings.baseUrl +
      '/api/public/fishStockings?' +
      new URLSearchParams({
        filter: JSON.stringify({
          status: ['FINISHED', 'INSPECTED', 'UPCOMING', 'ONGOING'],
        }),
        sort: '-eventTime',
        limit: ctx.params.limit.toString(),
      });

    const response: FishStocking[] = await ctx.call(
      'http.get',
      {
        url: url,
        opt: { responseType: 'json' },
      },
      {
        timeout: 0,
      },
    );

    for (let entry of response) {
      const fishesNames = entry.batches
        ?.map(
          (batch) =>
            `${batch.fishType.label} (${batch.fishAge.label.toLowerCase()}) ${
              batch.reviewAmount || batch.amount
            } vnt.`,
        )
        .join(', ');
      const transform = transformation('EPSG:4326', '3346');
      const transformedCoordinates = transform.forward([entry.coordinates.x, entry.coordinates.y]);

      const geom = getFeatureCollection({
        type: 'Point',
        coordinates: transformedCoordinates,
      });

      const bodyJSON = [
        { title: 'Būsena', value: StatusLabels[entry.status] },
        { title: 'Žuvys', value: fishesNames || '-' },
      ];

      const event: Partial<Event> = {
        name: `${entry.location.name} ${entry.location.cadastral_id}, ${entry.location.municipality.name}`,
        body: toEventBodyMarkdown(bodyJSON),
        startAt: new Date(entry.eventTime),
        geom,
        app: app.id,
        isFullDay: false,
        externalId: entry.id?.toString(),
      };

      await this.createOrUpdateEvent(ctx, app, event, !!ctx.params.initial);
    }

    await this.cleanupInvalidEvents(ctx, app);

    return this.finishIntegration();
  }
}
