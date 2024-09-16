import { Context } from 'moleculer';
import { Tag } from '../services/tags.service';
import { App, APP_TYPE } from '../services/apps.service';
import { differenceInDays, formatDuration, intervalToDuration } from 'date-fns';
import { Event } from '../services/events.service';
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
    actions: {},
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

        this.validExternalIds.push(event.externalId);

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
      async cleanupInvalidEvents(ctx: Context, apps: App | App[]) {
        if (!Array.isArray(apps)) {
          apps = [apps];
        }

        const validExternalIds = this.validExternalIds || [];
        const query = {
          app: { $in: apps.map((a) => a.id) },
        };

        let itemsCount: number = await ctx.call('events.count', { query, scope: false });
        const totalCount = itemsCount;
        let page = 1;
        this.stats.invalid.removed = 0;
        const startTime = new Date();

        const fields = ['id', 'deletedAt', 'externalId'];

        while (itemsCount > 0) {
          // remove with pagination
          const eventsPage: DBPagination<Event<null, 'id' | 'deletedAt' | 'externalId'>> =
            await ctx.call('events.list', {
              query,
              pageSize: 10000,
              page,
              fields,
              scope: false, // needed for not skipping any events
            });

          itemsCount = itemsCount - eventsPage.rows.length;
          page++;

          if (!eventsPage.rows.length) {
            itemsCount = 0;
          }

          const invalidEvents = eventsPage.rows.filter(
            (item) => !validExternalIds.includes(item.externalId) && !item.deletedAt,
          );

          for (const e of invalidEvents) {
            await ctx.call('events.remove', { id: e.id });
            this.addTotal();
            this.addInvalid();
            this.stats.invalid.removed++;
          }

          const progress = this.calcProgression(totalCount - itemsCount, totalCount, startTime);
          this.broker.logger.info(`${this.name} removing in progress: ${progress.text}`);
        }
      },
      addTotal() {
        this.stats.total++;
      },
      addInvalid() {
        this.stats.invalid.total++;
      },
      startIntegration(): IntegrationStats {
        this.validExternalIds = [];
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
