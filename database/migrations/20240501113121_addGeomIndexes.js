/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema
    .raw(`CREATE INDEX subscriptions_geom_idx ON subscriptions USING GIST (geom)`)
    .raw(`CREATE INDEX events_geom_idx ON events USING GIST (geom)`);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema
    .raw(`DROP INDEX IF EXISTS subscriptions_geom_idx`)
    .raw(`DROP INDEX IF EXISTS events_geom_idx`);
};
