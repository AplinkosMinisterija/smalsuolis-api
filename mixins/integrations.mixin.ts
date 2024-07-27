import { Context } from 'moleculer';
import { Tag } from '../services/tags.service';
import { App, APP_TYPE } from '../services/apps.service';
import { formatDuration, intervalToDuration } from 'date-fns';
import { Event } from '../services/events.service';

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
      async cleanupInvalidEvents(ctx: Context, app: App) {
        const invalidEvents: Event[] = await ctx.call('events.find', {
          query: {
            app: app.id,
            externalId: { $nin: this.validExternalIds },
          },
        });
        this.stats.invalid.removed = 0;
        for (const e of invalidEvents) {
          await ctx.call('events.remove', { id: e.id });
          this.addTotal();
          this.addInvalid();
          this.stats.invalid.removed++;
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
