const {
  query: oldEventsForPublishingQuery,
} = require('./20240131131339_createEventsForPublishing');

const eventsForPublishingQuery = `
SELECT
  e.id,
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
    .withSchema('publishing')
    .dropView('events')
    .createView('events', function (view) {
      view.as(knex.raw(eventsForPublishingQuery));
    });
};

exports.down = function (knex) {
  return knex.schema
    .withSchema('publishing')
    .dropView('events')
    .createView('events', function (view) {
      view.as(knex.raw(oldEventsForPublishingQuery));
    });
};
