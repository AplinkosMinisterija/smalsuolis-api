// @ts-ignore
import SentryMixin from 'moleculer-sentry';
import moleculer from 'moleculer';
import { Service } from 'moleculer-decorators';
import { Integrations } from '@sentry/node';

@Service({
  mixins: [SentryMixin],

  settings: {
    /** @type {Object?} Sentry configuration wrapper. */
    sentry: {
      /** @type {String} DSN given by sentry. */
      dsn: process.env.SENTRY_DSN,
      /** @type {String} Name of event fired by "Event" exported in tracing. */
      tracingEventName: '$tracing.spans',
      /** @type {Object} Additional options for `Sentry.init`. */
      options: {
        environment: process.env.ENVIRONMENT,
        release: process.env.VERSION,
        tracesSampleRate: 1,
        integrations: [
          // enable HTTP calls tracing
          new Integrations.Http({ tracing: true }),
          new Integrations.Postgres(),
        ],
      },
      /** @type {String?} Name of the meta containing user infos. */
      userMetaKey: 'user',
    },
  },
})
export default class SentryService extends moleculer.Service {}
