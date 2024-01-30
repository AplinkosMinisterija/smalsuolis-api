import knex, { Knex } from 'knex';
import { isEmpty } from 'lodash';
import { asGeoJsonQuery } from 'moleculer-postgis';
import config from '../knexfile';
import { User } from '../services/users.service';

let knexAdapter: Knex;
const getAdapter = () => {
  if (knexAdapter) return knexAdapter;

  knexAdapter = knex(config);
  return knexAdapter;
};

export async function getEventIdsByUserInfo(user: User): Promise<any[]> {
  if (isEmpty(user.geom) && isEmpty(user.apps)) return [];

  const eventsTable = 'events';
  const knex = getAdapter();
  const geomQuery = () => {
    return knex.raw(
      asGeoJsonQuery(`${eventsTable}.geom`, 'geom', 3346, {
        digits: 0,
        options: 0,
      }),
    );
  };

  const query = knex
    .select(`${eventsTable}.id`, `${eventsTable}.appId`, geomQuery())
    .from(eventsTable);

  if (!isEmpty(user.geom)) {
    query.where(
      knex.raw(`st_intersects(    st_transform(
      st_setsrid(
          ST_geomfromgeojson(${user.geom}),
          3346), 
      3346), ${eventsTable}.geom)`),
    );
  }

  if (!isEmpty(user.apps)) {
    query.whereIn(`${eventsTable}.appId`, user.apps);
  }

  return await query;
}
