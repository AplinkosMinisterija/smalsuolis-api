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
    .createTable('apps', (table) => {
      table.increments('id');
      table.string('name', 255);
      table.text('apiKey');
      commonFields(table);
    })
    .createTable('events', (table) => {
      table.increments('id');
      table.text('name');
      table.text('body');
      table.integer('appId');
      table.text('url');
      table.timestamp('date');
      commonFields(table);
    })
    .createTable('users', (table) => {
      table.increments('id');
      table.integer('authUserId').unsigned();
      table.string('firstName', 255);
      table.string('lastName', 255);
      table.string('email', 255);
      table.string('phone', 255);
      table
        .enu('type', ['USER', 'ADMIN'], {
          useNative: true,
          enumName: 'user_type',
        })
        .defaultTo('USER');
      commonFields(table);
    })
    .raw(`ALTER TABLE events ADD COLUMN geom geometry(geometry, 3346)`)
    .raw(`ALTER TABLE users ADD COLUMN geom geometry(geometry, 3346)`);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTable('apps').dropTable('events').dropTable('users');
};
