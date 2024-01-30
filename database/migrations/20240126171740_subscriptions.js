const { commonFields } = require('./20230420182712_setup');
const { Frequency } = require('../../types');
exports.up = function (knex) {
  return knex.schema.createTable('subscriptions', (table) => {
    table.increments('id');
    table.integer('userId').unsigned();
    table.jsonb('apps');
    table.enum('frequency', ['DAY', 'WEEK', 'MONTH']);
    table.boolean('active');
    table.timestamp('lastSent');
    commonFields(table);
  });
};

exports.down = function (knex) {};
