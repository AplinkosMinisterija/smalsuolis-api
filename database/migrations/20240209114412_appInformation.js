/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.alterTable('apps', (table) => {
    table.string('description');
    table.string('icon');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.alterTable('apps', (table) => {
    table.dropColumn('description');
    table.dropColumn('icon');
  });
};
