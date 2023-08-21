/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.alterTable('events', (table) => {
    table.timestamp('startAt').after('date');
    table.timestamp('endAt').after('startAt');
    table.boolean('isFullDay');
    table.dropColumn('date');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.alterTable('events', (table) => {
    table.dropColumn('startAt');
    table.dropColumn('endAt');
    table.dropColumn('isFullDay');
    table.timestamp('date').after('url');
  });
};
