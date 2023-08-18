'use strict';

import _ from 'lodash';
const DbService = require('@moleculer/database').Service;
import config from '../knexfile';
import filtersMixin from 'moleculer-knex-filters';
import { Context } from 'moleculer';
import { parseToJsonIfNeeded } from '../utils';

export const MaterializedView = {
  TAXONOMIES_ALL: 'taxonomiesAll',
  PLACES_WITH_TAXONOMIES: 'placesWithTaxonomies',
  APPROVED_FORMS: 'approvedForms',
};

function makeMapping(
  data: any[],
  mapping?: string,
  options?: {
    mappingMulti?: boolean;
    mappingField?: string;
  }
) {
  if (!mapping) return data;

  return data?.reduce((acc: any, item) => {
    let value: any = item;

    if (options?.mappingField) {
      value = item[options.mappingField];
    }

    if (options?.mappingMulti) {
      return {
        ...acc,
        [`${item[mapping]}`]: [...(acc[`${item[mapping]}`] || []), value],
      };
    }

    return { ...acc, [`${item[mapping]}`]: value };
  }, {});
}

export default function (opts: any = {}) {
  const adapter: any = {
    type: 'Knex',
    options: {
      knex: config,
      // collection: opts.collection,
      tableName: opts.collection,
    },
  };

  const cache = {
    enabled: false,
  };

  opts = _.defaultsDeep(opts, { adapter }, { cache: opts.cache || cache });

  const removeRestActions: any = {};

  if (opts?.createActions === undefined || opts?.createActions !== false) {
    removeRestActions.replace = {
      rest: null as any,
    };
  }

  const schema = {
    mixins: [DbService(opts), filtersMixin()],

    async started() {
      await this.getAdapter();
    },

    actions: {
      ...removeRestActions,

      async findOne(ctx: any) {
        const result: any[] = await ctx.call(`${this.name}.find`, ctx.params);
        if (result.length) return result[0];
        return;
      },

      async removeAllEntities(ctx: any) {
        return await this.clearEntities(ctx);
      },

      async populateByProp(
        ctx: Context<{
          id: number | number[];
          queryKey: string;
          query: any;
          mapping?: boolean;
          mappingMulti?: boolean;
          mappingField: string;
        }>
      ): Promise<any> {
        const { id, queryKey, query, mapping, mappingMulti, mappingField } =
          ctx.params;

        delete ctx.params.queryKey;
        delete ctx.params.id;
        delete ctx.params.mapping;
        delete ctx.params.mappingMulti;
        delete ctx.params.mappingField;

        const entities = await this.findEntities(ctx, {
          ...ctx.params,
          query: {
            ...(query || {}),
            [queryKey]: { $in: id },
          },
        });

        return makeMapping(entities, mapping ? queryKey : '', {
          mappingMulti,
          mappingField: mappingField,
        });
      },
    },

    methods: {
      filterQueryIds(ids: number[], queryIds?: any) {
        if (!queryIds) return ids;

        queryIds = (Array.isArray(queryIds) ? queryIds : [queryIds]).map(
          (id: any) => parseInt(id)
        );

        return ids.filter((id) => queryIds.indexOf(id) >= 0);
      },

      async refreshMaterializedView(ctx: Context, name: string) {
        const adapter = await this.getAdapter(ctx);

        await adapter.client.schema.refreshMaterializedView(name);
        return {
          success: true,
        };
      },

      async applyFilterFunction(
        ctx: Context<{ query: { [key: string]: any } }>
      ) {
        ctx.params.query = parseToJsonIfNeeded(ctx.params.query);

        if (!ctx.params?.query) {
          return ctx;
        }

        for (const key of Object.keys(ctx.params.query)) {
          if (this.settings?.fields?.[key]?.filterFn) {
            if (typeof this.settings?.fields?.[key]?.filterFn === 'function') {
              ctx.params.query[key] = await this.settings?.fields?.[
                key
              ]?.filterFn({
                value: ctx.params.query[key],
                query: ctx.params.query,
              });
            }
          }
        }

        return ctx;
      },
    },

    hooks: {
      before: {
        find: 'applyFilterFunction',
        list: 'applyFilterFunction',
      },
      after: {
        find: [
          async function (
            ctx: Context<{
              mapping: string;
              mappingMulti: boolean;
              mappingField: string;
            }>,
            data: any[]
          ) {
            const { mapping, mappingMulti, mappingField } = ctx.params;
            return makeMapping(data, mapping, {
              mappingMulti,
              mappingField,
            });
          },
        ],
      },
    },

    merged(schema: any) {
      if (schema.actions) {
        for (const action in schema.actions) {
          const params = schema.actions[action].additionalParams;
          if (typeof params === 'object') {
            schema.actions[action].params = {
              ...schema.actions[action].params,
              ...params,
            };
          }
        }
      }
    },
  };

  return schema;
}
