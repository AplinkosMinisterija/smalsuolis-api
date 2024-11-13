import { differenceInDays, formatDuration, intervalToDuration } from 'date-fns';
import { Context } from 'moleculer';
import { App, APP_TYPE } from '../services/apps.service';
import { Event } from '../services/events.service';
import { Tag } from '../services/tags.service';
import { DBPagination } from '../types';

export type IntegrationStats = {
  total: number;
  valid: {
    total: number;
    inserted: number;
    updated: number;
  };
  invalid: {
    total: number;
  };
  startTime?: Date;
  endDate?: Date;
  duration?: String;
};

export function IntegrationsMixin() {
  const schema = {
    actions: {
      sync: {
        rest: 'POST /sync',
        timeout: 0,
        handler(ctx: Context) {
          ctx.call(`${this.name}.getData`);
          return {
            success: true,
          };
        },
      },
    },
    methods: {
      async makeRequestWithRetries(request: Function, retryCount: number = 1) {
        async function staleFor(seconds: number) {
          return new Promise((resolve) => {
            setTimeout(resolve, 1000 * seconds);
          });
        }

        let keepTrying = true;
        let tries = 0;
        let response;
        do {
          tries++;
          try {
            response = await request({ retryCount, tries });
            keepTrying = false;
          } catch (err) {
            await staleFor(tries);
            keepTrying = true;
          }
        } while (tries < retryCount && keepTrying);

        if (!response) throw Error('No response');
        return response;
      },
      calcProgression(count: number, total: number, startTime: Date) {
        const currentTime = new Date();
        const percentage = Math.round((count / total) * 10000) / 100;

        const estimatedEndTime = new Date(
          (currentTime.getTime() - startTime.getTime()) / (percentage / 100) + startTime.getTime(),
        );
        const duration = formatDuration(intervalToDuration({ start: startTime, end: currentTime }));
        const estimatedDuration = formatDuration(
          intervalToDuration({ start: startTime, end: estimatedEndTime }),
        );
        return {
          count,
          total,
          percentage,
          duration,
          estimatedDuration,
          text: `${count} of ${total} (${percentage}%) - ${duration} (est. ${estimatedDuration})`,
        };
      },
      async createOrUpdateEvent(
        ctx: Context,
        app: App,
        event: Partial<Event>,
        initial: boolean = false,
      ) {
        this.addTotal();

        if (!event.externalId) {
          this.addInvalid();
          return;
        }

        const existingEvent: Event = await ctx.call('events.findOne', {
          query: {
            externalId: event.externalId,
            app: app.id,
          },
        });

        // Let's save old events (older than 30 days) as initial events
        initial = initial || differenceInDays(new Date(), event.startAt) > 30;

        if (initial) {
          event.createdAt = event.startAt;
        }

        this.validExternalIds.add(event.externalId);

        if (existingEvent?.id) {
          await ctx.call('events.update', {
            id: Number(existingEvent.id),
            ...event,
          });
          this.stats.valid.updated++;
          this.stats.valid.total++;
        } else {
          await ctx.call('events.create', event);

          this.stats.valid.inserted++;
          this.stats.valid.total++;
        }
      },

      async createOrUpdateEvents(
        ctx: Context,
        apps: App | App[],
        events: Partial<Event>[],
        initial: boolean = false,
      ) {
        if (!Array.isArray(apps)) {
          apps = [apps];
        }

        this.addTotal(events.length);

        const externalIds = events.map((e) => e.externalId).filter((id) => id);
        const existingEventsMap: { [key: string]: Event } = await ctx.call('events.find', {
          mapping: 'externalId',
          query: {
            externalId: { $in: externalIds },
            app: { $in: apps.map((a) => a.id) },
          },
        });

        for (const event of events) {
          if (!event.externalId) {
            this.addInvalid();
            continue;
          }

          // Let's save old events (older than 30 days) as initial events
          initial = initial || differenceInDays(new Date(), event.startAt) > 30;
          if (initial) {
            event.createdAt = event.startAt;
          }

          this.validExternalIds.add(event.externalId);

          const existingEvent = existingEventsMap[event.externalId];

          if (existingEvent?.id) {
            await ctx.call('events.update', {
              id: Number(existingEvent.id),
              ...event,
            });
            this.stats.valid.updated++;
            this.stats.valid.total++;
          } else {
            await ctx.call('events.create', event);
            this.stats.valid.inserted++;
            this.stats.valid.total++;
          }
        }
      },

      async cleanupInvalidEvents(ctx: Context, apps: App | App[]) {
        if (!Array.isArray(apps)) {
          apps = [apps];
        }

        const validExternalIds = this.validExternalIds || new Set();
        const query = {
          app: { $in: apps.map((a) => a.id) },
        };

        const totalCount: number = await ctx.call('events.count', { query, scope: false });
        this.stats.invalid.removed = 0;
        const startTime = new Date();

        const fields = ['id', 'deletedAt', 'externalId'];

        const pageSize = 5000;

        for (let page = 1; page <= Math.ceil(totalCount / pageSize); page++) {
          const eventsPage: DBPagination<Event<null, 'id' | 'deletedAt' | 'externalId'>> =
            await ctx.call('events.list', {
              query,
              pageSize,
              page,
              fields,
              sort: 'id',
              scope: false, // needed for not skipping any events
            });

          if (!eventsPage.rows.length) {
            continue;
          }

          const invalidEventsIds = eventsPage.rows
            .filter(
              (item) => !validExternalIds.has(item.externalId) && !item.deletedAt && !!item.id,
            )
            .map((e) => e.id);

          const invalidEventsCount = invalidEventsIds?.length || 0;

          if (invalidEventsCount) {
            await ctx.call('events.removeMany', { id: invalidEventsIds });
            this.addTotal(invalidEventsCount);
            this.addInvalid(invalidEventsCount);
            this.stats.invalid.removed += invalidEventsCount;
          }

          const progress = this.calcProgression(page * pageSize, totalCount, startTime);
          this.broker.logger.info(`${this.name} removing in progress: ${progress.text}`);
        }
      },
      addTotal(count: number = 1) {
        this.stats.total += count;
      },
      addInvalid(count: number = 1) {
        this.stats.invalid.total += count;
      },
      startIntegration(): IntegrationStats {
        this.validExternalIds = new Set();
        this.stats = {
          total: 0,
          valid: {
            total: 0,
            inserted: 0,
            updated: 0,
          },
          invalid: {
            total: 0,
          },
          startTime: new Date(),
        };
        return this.stats;
      },
      finishIntegration(): IntegrationStats {
        this.broker.emit('integrations.sync.finished');
        this.stats.endTime = new Date();
        this.stats.duration = formatDuration(
          intervalToDuration({ start: this.stats.startTime, end: this.stats.endTime }),
        );

        this.broker.logger.info(`${this.name} sync finish`, this.stats);

        return this.stats;
      },
      async findOrCreateTags(ctx: Context, names: string[], appKey: string) {
        this.tags = this.tags || {};

        const appType = APP_TYPE[appKey];

        if (!Object.keys(this.tags).length) {
          this.tags = await ctx.call('tags.find', {
            query: { appType },
            mapping: 'name',
          });
        }

        const tagsIds: number[] = [];

        names = names.filter((n) => !!n);

        if (!names.length) return tagsIds;

        for (const name of names) {
          if (!this.tags[name]) {
            const tag: Tag = await ctx.call('tags.create', {
              appType,
              name,
            });

            this.tags[name] = tag;
          }

          if (this.tags[name]) {
            tagsIds.push(this.tags[name].id);
          }
        }

        return tagsIds;
      },
    },
  };

  return schema;
}
