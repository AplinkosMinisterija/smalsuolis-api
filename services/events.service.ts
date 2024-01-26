'use strict';

import moleculer, { Context } from 'moleculer';
import { Method, Service } from 'moleculer-decorators';

import DbConnection from '../mixins/database.mixin';
import {
  COMMON_FIELDS,
  COMMON_DEFAULT_SCOPES,
  COMMON_SCOPES,
  FieldHookCallback,
  BaseModelInterface,
  EndpointType,
} from '../types';
import { App } from './apps.service';
import GeometriesMixin from '../mixins/geometries.mixin';
import {
  geometriesToGeomCollection,
  geometryFilterFn,
  geometryFromText,
  geometryToGeom,
  GeomFeatureCollection,
} from '../modules/geometry';

export interface Event extends BaseModelInterface {
  name: string;
  app: App['id'];
  type: string;
  geom: any;
  url: string;
  body: string;
  startAt: Date;
  endAt: Date;
  isFullDay: boolean;
}

@Service({
  name: 'events',

  mixins: [
    DbConnection({
      collection: 'events',
    }),
    GeometriesMixin,
  ],

  settings: {
    fields: {
      id: {
        type: 'number',
        columnType: 'integer',
        primaryKey: true,
        secure: true,
      },

      name: 'string|required',
      geom: {
        type: 'any',
        raw: true,
        get({ value }: any) {
          if (typeof value === 'string') return;
          return value;
        },
        filterFn: ({ value }: any) => geometryFilterFn(value),
        populate: {
          keyField: 'id',
          action: 'events.getGeometryJson',
        },
      },

      app: {
        type: 'number',
        columnType: 'integer',
        hidden: 'byDefault',
        columnName: 'appId',
        onCreate: ({ ctx }: FieldHookCallback) => ctx.meta.app?.id,
      },

      url: 'string',
      body: 'string',

      startAt: {
        type: 'date',
        required: true,
        columnType: 'datetime',
      },

      endAt: {
        type: 'date',
        required: true,
        columnType: 'datetime',
      },

      isFullDay: {
        type: 'boolean',
        default: false,
      },

      ...COMMON_FIELDS,
    },

    scopes: {
      ...COMMON_SCOPES,
    },

    defaultScopes: [...COMMON_DEFAULT_SCOPES],
  },
  hooks: {
    before: {
      create: ['parseGeomField'],
      update: ['parseGeomField'],
    },
  },
  actions: {
    create: {
      auth: EndpointType.APP,
    },
    update: {
      auth: EndpointType.APP,
    },
    remove: {
      auth: EndpointType.APP,
    },
    list: {
      auth: EndpointType.PUBLIC,
    },
    get: {
      auth: EndpointType.PUBLIC,
    },
    find: {
      rest: null,
    },
    count: {
      rest: null,
    },
  },
})
export default class EventsService extends moleculer.Service {
  @Method
  async parseGeomField(ctx: Context<{ geom: GeomFeatureCollection }>) {
    const { geom } = ctx.params;

    const errMessage = 'Geometry as feature collection should be passed';

    if (!geom?.features?.length) {
      throw new moleculer.Errors.ValidationError(errMessage);
    }

    const adapter = await this.getAdapter(ctx);
    const table = adapter.getTable();

    try {
      const geomItem = geom.features[0];
      const value = geometryToGeom(geomItem.geometry);
      ctx.params.geom = table.client.raw(geometryFromText(value));
    } catch (err) {
      throw new moleculer.Errors.ValidationError(err.message);
    }

    return ctx;
  }
}
