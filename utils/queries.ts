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

export async function getEventIdsByUserInfo(user: User): Promise<any[]> {
  if (isEmpty(user.geom) && isEmpty(user.apps)) return [];

  const eventsTable = 'events';
  const knex = getAdapter();

  const query = knex.select(`${eventsTable}.id`).from(eventsTable);

  if (!isEmpty(user.geom)) {
    query.where(knex.raw(`st_intersects(${user.geom}, ${eventsTable}.geom)`));
  }

  if (!isEmpty(user.apps)) {
    query.whereIn(
      `${eventsTable}.app`,
      user.apps.map((app) => app.id),
    );
  }

  return await query;
}
