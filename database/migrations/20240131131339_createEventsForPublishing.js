const eventsForPublishingQuery = `
SELECT
  e.name,
  e.body,
  e.url,
  e.start_at,
  e.end_at,
  e.is_full_day,
  e.geom,
  a.name AS app_name
FROM
  "events" e
  LEFT JOIN "apps" a ON a.id = e.app_id
`;

exports.query = eventsForPublishingQuery;

exports.up = function (knex) {
  return knex.schema
    .raw('CREATE SCHEMA IF NOT EXISTS publishing')
    .withSchema('publishing')
    .createViewOrReplace('events', function (view) {
      view.as(knex.raw(eventsForPublishingQuery));
    });
};

exports.down = function (knex) {
  return knex.schema
    .withSchema('publishing')
    .dropViewIfExists('events')
    .raw('DROP SCHEMA IF EXISTS publishing');
};
