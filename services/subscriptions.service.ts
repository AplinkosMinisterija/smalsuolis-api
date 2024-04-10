'use strict';

import { FeatureCollection, parse } from 'geojsonjs';
import _ from 'lodash';
import moleculer, { Context } from 'moleculer';
import { Action, Method, Service } from 'moleculer-decorators';
import PostgisMixin, { asGeoJsonQuery, intersectsQuery } from 'moleculer-postgis';
import { PopulateHandlerFn } from 'moleculer-postgis/src/mixin';
import DbConnection from '../mixins/database.mixin';
import {
  CommonFields,
  CommonPopulates,
  COMMON_DEFAULT_SCOPES,
  COMMON_FIELDS,
  COMMON_SCOPES,
  EndpointType,
  FieldHookCallback,
  Frequency,
  Table,
  throwNoRightsError,
  UserAuthMeta,
} from '../types';
import { getDateByFrequency, LKS_SRID } from '../utils';
import { App } from './apps.service';
import { Event } from './events.service';
import { User } from './users.service';

interface Fields extends CommonFields {
  user: User['id'];
  apps: number[];
  geom: FeatureCollection;
  frequency: Frequency;
  active: boolean;
  geomWithBuffer?: FeatureCollection;
}

interface Populates extends CommonPopulates {
  apps: App[];
  user: User;
}

export type Subscription<
  P extends keyof Populates = never,
  F extends keyof (Fields & Populates) = keyof Fields,
> = Table<Fields, Populates, P, F>;

@Service({
  name: 'subscriptions',
  mixins: [DbConnection({ collection: 'subscriptions' }), PostgisMixin({ srid: LKS_SRID })],
  settings: {
    fields: {
      id: {
        type: 'string',
        columnType: 'integer',
        primaryKey: true,
        secure: true,
      },
      user: {
        //subscriber
        type: 'number',
        required: true,
        columnType: 'integer',
        columnName: 'userId',
        immutable: true,
        readonly: true,
        populate: 'users.resolve',
        onCreate: async ({ ctx }: FieldHookCallback) => ctx.meta.user?.id,
        onUpdate: async ({ ctx, entity }: FieldHookCallback) => {
          if (entity.userId !== ctx.meta.user?.id) {
            return throwNoRightsError('Unauthorized');
          }
          return entity.userId;
        },
      },
      apps: {
        //apps subscribed to
        type: 'array',
        required: true,
        items: { type: 'number' },
        columnName: 'apps',
        validate: 'validateApps',
        populate(ctx: any, _values: any, items: Subscription[]) {
          return Promise.all(
            items.map((item: Subscription) => {
              if (!item.apps) return [];
              if (typeof item.apps === 'string') item.apps = JSON.parse(item.apps);
              return ctx.call('apps.resolve', { id: item.apps });
            }),
          );
        },
      },
      geom: {
        type: 'any',
        geom: {
          type: 'geom',
          properties: {
            bufferSize: 'geomBufferSize',
          },
        },
        required: true,
      },

      geomBufferSize: {
        // radius in meters
        type: 'number',
        set({ params }: any) {
          const bufferSizes = this._getPropertiesFromFeatureCollection(params.geom, 'bufferSize');
          if (!bufferSizes || !bufferSizes?.length) return;
          return bufferSizes[0] || 1000;
        },
        hidden: 'byDefault',
      },

      eventsCount: {
        virtual: true,
        type: 'number',
        async populate(ctx: any, _values: any) {
          const subscriptions: Subscription[] = await this.findEntities(ctx, {
            populate: 'geomWithBuffer',
          });

          return Promise.all(
            subscriptions.map(async (subscription: Subscription) => {
              const query = {
                ...(!!subscription.apps?.length && { app: { $in: subscription.apps } }),
                $raw: intersectsQuery('geom', subscription.geomWithBuffer, LKS_SRID),
              };

              const total = await ctx.call('events.find', {
                query,
              });

              const latest = total.filter(
                (event: Event) => event.startAt > getDateByFrequency(subscription.frequency),
              );

              return { total: total.length, latest: latest.length };
            }),
          );
        },
      },

      geomWithBuffer: {
        virtual: true,
        populate: {
          keyField: 'id',
          handler: PopulateHandlerFn('subscriptions.getGeomWithBuffer'),
          params: {
            mapping: true,
          },
        },
      },

      frequency: {
        // email sending frequency
        type: 'enum',
        values: Object.values(Frequency),
      },
      active: 'boolean', // is subscription active
      ...COMMON_FIELDS,
    },
    scopes: {
      user(query: any, ctx: Context<null, UserAuthMeta>, params: any) {
        const { user } = ctx.meta;
        if (!user?.id) return query;
        query.user = user.id;
        return query;
      },
      ...COMMON_SCOPES,
    },
    defaultScopes: [...COMMON_DEFAULT_SCOPES, 'user'],
  },
  actions: {
    create: {
      auth: EndpointType.USER,
    },
    update: {
      auth: EndpointType.USER,
    },
    list: {
      auth: EndpointType.USER,
    },
    find: {
      auth: EndpointType.USER,
    },
    get: {
      auth: EndpointType.USER,
    },
    count: {
      auth: EndpointType.USER,
    },
    remove: {
      auth: EndpointType.USER,
    },
  },
  hooks: {
    before: {
      remove: ['beforeRemove'],
    },
  },
})
export default class SubscriptionsService extends moleculer.Service {
  @Action({
    params: {
      id: [
        'number|convert',
        {
          type: 'array',
          items: 'number|convert',
        },
      ],
      mapping: 'boolean|optional',
    },
  })
  async getGeomWithBuffer(
    ctx: Context<{
      id: number | number[];
      mapping: boolean;
    }>,
  ) {
    const adapter = await this.getAdapter(ctx);
    const table = adapter.getTable();

    const { id, mapping } = ctx.params;
    const multi = Array.isArray(id);

    const geomField = _.snakeCase('geom');
    const geomBufferField = _.snakeCase('geomBufferSize');

    const transformGeomQuery = `
      CASE
        WHEN ST_GeometryType(${geomField}) IN (
          'ST_Point',
          'ST_LineString',
          'ST_MultiPoint',
          'ST_MultiLineString'
        ) THEN ST_Buffer(${geomField}, ${geomBufferField})
        WHEN ST_GeometryType(${geomField}) IN ('ST_Polygon', 'ST_MultiPolygon') THEN ${geomField}
      END
    `;

    const query = table.select(
      'id',
      table.client.raw(
        asGeoJsonQuery(transformGeomQuery, 'geom', LKS_SRID, {
          digits: 3,
          options: 0,
        }),
      ),
    );

    query[multi ? 'whereIn' : 'where']('id', id);

    const res: any[] = (await query).map((el: any) => ({
      id: el.id,
      geom: parse(el.geom),
    }));

    if (!mapping) return res;

    const result = res.reduce(
      (acc: { [key: string]: any }, item) => ({ ...acc, [`${item.id}`]: item.geom }),
      {},
    );

    return result;
  }

  @Method
  async validateApps({ ctx, value, entity }: FieldHookCallback) {
    const apps: App[] = await ctx.call('apps.find', {
      query: {
        id: { $in: value },
      },
    });
    const ids = apps.map((app: App) => app.id);
    const diff = value.filter((id: number) => !ids.includes(id));
    if (apps.length !== value.length) {
      return `Invalid app ids [${diff.toString()}]`;
    }
    return true;
  }

  @Method
  async beforeRemove(ctx: Context<{ id: number }, UserAuthMeta>) {
    const subscription = await this.findEntity(ctx, { id: ctx.params.id });
    if (subscription?.user !== ctx.meta.user.id) {
      throwNoRightsError();
    }
  }
}
