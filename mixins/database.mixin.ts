'use strict';

import _ from 'lodash';
const DbService = require('@moleculer/database').Service;
import config from '../knexfile';
import filtersMixin from 'moleculer-knex-filters';
import { Context } from 'moleculer';
import { parseToJsonIfNeeded } from '../utils';

type ActionType = string | { [key: string]: string };

const PromiseAllObject = (obj: any) => {
  if (obj && !obj[Symbol.iterator]) {
    return Promise.all(Object.entries(obj).map(async ([k, v]) => [k, await v])).then(
      Object.fromEntries,
    );
  }
  return Promise.all(obj);
};

export function PopulateHandlerFn(action: ActionType) {
  const populateSubproperties = _.isObject(action);

  return async function (
    ctx: Context<{ populate: string | string[] }>,
    values: any[],
    docs: any[],
    field: any,
  ) {
    if (!values.length) return null;
    const rule = field.populate;
    let populate = rule.params?.populate;
    if (rule.inheritPopulate) {
      populate = ctx.params.populate;
    }

    let fieldName = field.name;
    if (rule.keyField) {
      fieldName = rule.keyField;
    }

    async function getValuesByKey(values: any[], action: ActionType): Promise<any> {
      if (_.isObject(action)) {
        const promisesByActionKeys = Object.keys(action).reduce((acc: any, key: string) => {
          const keyValues = values.map((v) => v[key]);

          return { ...acc, [key]: getValuesByKey(keyValues, action[key]) };
        }, {});

        return PromiseAllObject(promisesByActionKeys);
      }

      const params = {
        ...(rule.params || {}),
        id: values,
        mapping: true,
        populate,
        throwIfNotExist: false,
      };

      return ctx.call(action, params, rule.callOptions);
    }

    const byKey: any = await getValuesByKey(values, action);

    function mapValues(fieldValue: any) {
      return Object.keys(fieldValue).reduce((acc: any, key: string) => {
        let value = fieldValue[key];
        if (!value) return acc;

        if (byKey[key]) {
          if (!fieldValue[key]) return acc;
          value = byKey[key][`${fieldValue[key]}`];
        }

        return { ...acc, [key]: value };
      }, {});
    }

    return docs?.map((d) => {
      const fieldValue = d[fieldName];
      if (!fieldValue) return null;

      if (populateSubproperties) {
        if (Array.isArray(fieldValue)) {
          return fieldValue.map(mapValues);
        }
        return mapValues(fieldValue);
      }
      return byKey[fieldValue] || null;
    });
  };
}

function makeMapping(
  data: any[],
  mapping?: string,
  options?: {
    mappingMulti?: boolean;
    mappingField?: string;
  },
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

      async removeMany(ctx: any) {
        return this.removeEntities(ctx, {
          query: {
            id: { $in: ctx.params.id },
          },
        });
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
        }>,
      ): Promise<any> {
        const { id, queryKey, query, mapping, mappingMulti, mappingField } = ctx.params;

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

        queryIds = (Array.isArray(queryIds) ? queryIds : [queryIds]).map((id: any) => parseInt(id));

        return ids.filter((id) => queryIds.indexOf(id) >= 0);
      },

      async applyFilterFunction(ctx: Context<{ query: { [key: string]: any } }>) {
        ctx.params.query = parseToJsonIfNeeded(ctx.params.query);

        if (!ctx.params?.query) {
          return ctx;
        }

        for (const key of Object.keys(ctx.params.query)) {
          if (this.settings?.fields?.[key]?.filterFn) {
            if (typeof this.settings?.fields?.[key]?.filterFn === 'function') {
              ctx.params.query[key] = await this.settings?.fields?.[key]?.filterFn({
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
            data: any[],
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
