const { commonFields } = require('./20230420182712_setup');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema
    .createTable('tags', (table) => {
      table.increments('id');
      table.string('name');
      table.string('appType');
      commonFields(table);
    })
    .alterTable('events', (table) => {
      table.jsonb('tags');
      table.jsonb('tagsData');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTable('tags').alterTable('events', (table) => {
    table.dropColumn('tags');
    table.dropColumn('tagsData');
  });
};
