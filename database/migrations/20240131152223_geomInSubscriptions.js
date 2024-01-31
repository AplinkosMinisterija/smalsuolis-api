const commonFields = (table) => {
  table.timestamp('createdAt');
  table.integer('createdBy').unsigned();
  table.timestamp('updatedAt');
  table.integer('updatedBy').unsigned();
  table.timestamp('deletedAt');
  table.integer('deletedBy').unsigned();
};

exports.commonFields = commonFields;

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema
    .alterTable('users', (table) => {
      table.dropColumn('geom');
    })
    .raw(`CREATE EXTENSION IF NOT EXISTS postgis;`)
    .raw(`ALTER TABLE subscriptions ADD COLUMN geom geometry(geometry, 3346)`);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema
    .alterTable('subscriptions', (table) => {
      table.dropColumn('geom');
    })
    .raw(`CREATE EXTENSION IF NOT EXISTS postgis;`)
    .raw(`ALTER TABLE users ADD COLUMN geom geometry(geometry, 3346)`);
};
