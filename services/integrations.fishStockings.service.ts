'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
import { Event, toEventBodyMarkdown } from './events.service';
import { APP_KEYS, App } from './apps.service';
import transformation from 'transform-coordinates';

// @ts-ignore
import Cron from '@r2d2bzh/moleculer-cron';
import { getFeatureCollection } from 'geojsonjs';

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
  mixins: [Cron],
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
    const stats = {
      total: 0,
      valid: {
        total: 0,
        inserted: 0,
        updated: 0,
      },
      invalid: {
        total: 0,
      },
    };

    const app: App = await ctx.call('apps.findOne', {
      query: {
        key: APP_KEYS.izuvinimas,
      },
    });

    if (app?.id) {
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

      const ids = [];

      for (let entry of response) {
        stats.total++;

        ids.push(entry.id);

        const fishesNames = entry.batches
          ?.map(
            (batch) =>
              `${batch.fishType.label} (${batch.fishAge.label.toLowerCase()}) ${
                batch.reviewAmount || batch.amount
              } vnt.`,
          )
          .join(', ');
        const transform = transformation('EPSG:4326', '3346');
        const transformedCoordinates = transform.forward([
          entry.coordinates.x,
          entry.coordinates.y,
        ]);

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

        if (ctx.params.initial) {
          event.createdAt = event.startAt;
        }

        const existingEvent: Event = await ctx.call('events.findOne', {
          query: {
            app: app.id,
            externalId: entry.id,
          },
        });

        if (existingEvent?.id) {
          await ctx.call('events.update', {
            id: Number(existingEvent.id),
            ...event,
          });
          stats.valid.total++;
          stats.valid.updated++;
        } else {
          await ctx.call('events.create', event);
          stats.valid.total++;
          stats.valid.inserted++;
        }
      }

      const invalidEvents: Event[] = await ctx.call('events.find', {
        query: {
          app: app.id,
          externalId: { $nin: ids },
        },
      });

      for (const e of invalidEvents) {
        const deleted = await ctx.call('events.remove', { id: e.id });
        stats.total++;
        stats.invalid.total++;
      }
    }

    this.broker.emit('integrations.sync.finished');
    return stats;
  }
}
