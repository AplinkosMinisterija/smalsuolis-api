import { Context } from 'moleculer';
import { Tag } from '../services/tags.service';
import { APP_TYPE } from '../services/apps.service';

export function IntegrationsMixin(opts: {} = {}) {
  const schema = {
    actions: {},
    methods: {
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
