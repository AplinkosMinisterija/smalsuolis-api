exports.up = function (knex) {
  return knex.schema.alterTable('events', function (table) {
    table.index('appId');
    table.index('externalId');
    table.index(['externalId', 'appId']);
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('events', function (table) {
    table.dropIndex('appId');
    table.dropIndex('externalId');
    table.dropIndex(['externalId', 'appId']);
  });
};
