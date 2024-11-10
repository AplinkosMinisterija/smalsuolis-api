exports.up = function (knex) {
  return knex.schema.alterTable('events', function (table) {
    table.index('appId', 'appId_index');
    table.index('externalId', 'externalId_index');
    table.index(['externalId', 'appId'], 'externalId_app_id_index');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('events', function (table) {
    table.dropIndex('appId', 'appId_index');
    table.dropIndex('externalId', 'externalId_index');
    table.dropIndex(['externalId', 'appId'], 'externalId_app_id_index');
  });
};
