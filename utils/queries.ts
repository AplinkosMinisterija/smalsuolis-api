import knex, { Knex } from 'knex';
import { isEmpty } from 'lodash';
import config from '../knexfile';
import { User } from '../services/users.service';

let knexAdapter: Knex;
const getAdapter = () => {
  if (knexAdapter) return knexAdapter;

  knexAdapter = knex(config);
  return knexAdapter;
};

export async function getEventIdsByUserInfo(user: User): Promise<{ id: number }[]> {
  const eventsTable = 'events';
  const knex = getAdapter();

  const query = knex.select(`${eventsTable}.id`).from(eventsTable);

  if (!isEmpty(user.geom)) {
    query.whereRaw(`ST_Intersects(:geom,${eventsTable}.geom)`, {
      geom: user.geom,
    });
  }

  if (!isEmpty(user.apps)) {
    query.whereIn(`${eventsTable}.appId`, user.apps);
  }

  return await query;
}
