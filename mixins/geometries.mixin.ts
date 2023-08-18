'use strict';

import { Context } from 'moleculer';
import { GeomFeature, GeomFeatureCollection } from '../modules/geometry';

export function geomTransformFn(field: string) {
  return `ST_Transform(${field || 'geom'}, 3346)`;
}

export function geomAsGeoJsonFn(
  field: string = '',
  asField: string = 'geom',
  digits: number = 0,
  options: number = 0
) {
  field = geomTransformFn(field);
  asField = asField ? ` as ${asField}` : '';
  return `ST_AsGeoJSON(${field}, ${digits}, ${options})::json${asField}`;
}

export function distanceFn(field1: string, field2: string) {
  const geom1 = geomTransformFn(field1);
  const geom2 = geomTransformFn(field2);
  return `ROUND(ST_Distance(${geom1}, ${geom2}))`;
}

export function areaFn(field: string) {
  return `ROUND(ST_Area(${geomTransformFn(field)}))`;
}

export function featuresToFeatureCollection(features: any[]) {
  return {
    type: 'FeatureCollection',
    features,
  };
}

export function geomToFeatureCollection(geom: any, properties?: any) {
  if (!geom) return;

  const getFeature = (geom: any) => {
    return {
      type: 'Feature',
      geometry: geom,
      properties: properties || null,
    };
  };

  let geometries = [geom];
  if (geom.geometries?.length) {
    geometries = geom.geometries;
  }

  return featuresToFeatureCollection(geometries.map((g: any) => getFeature(g)));
}

export default {
  actions: {
    async getGeometryJson(
      ctx: Context<{
        id: number | number[];
        field?: string;
        propertiesById?: { [key: string]: any };
      }>
    ): Promise<GeomFeatureCollection> {
      const adapter = await this.getAdapter(ctx);
      const table = adapter.getTable();

      const { id, field, propertiesById } = ctx.params;
      const multi = Array.isArray(id);
      const query = table.select(
        'id',
        table.client.raw(geomAsGeoJsonFn(field))
      );

      query[multi ? 'whereIn' : 'where']('id', id);

      const res: any[] = await query;

      const result = res.reduce((acc: { [key: string]: any }, item) => {
        acc[`${item.id}`] = geomToFeatureCollection(
          item.geom,
          propertiesById && propertiesById[`${item.id}`]
        );
        return acc;
      }, {});

      if (!multi) return result[`${id}`];
      return result;
    },
    async getGeometryArea(
      ctx: Context<{
        id: number | number[];
        field?: string;
      }>
    ) {
      const adapter = await this.getAdapter(ctx);
      const table = adapter.getTable();

      const { id, field } = ctx.params;
      const multi = Array.isArray(id);

      const query = table.select(
        'id',
        table.client.raw(`${areaFn(field)} as area`)
      );

      query[multi ? 'whereIn' : 'where']('id', id);

      const res: any[] = await query;

      const result = res.reduce((acc: { [key: string]: any }, item) => {
        acc[`${item.id}`] = Number(Number(item.area).toFixed(2));
        return acc;
      }, {});

      if (!multi) return result[`${id}`];
      return result;
    },
  },
};
