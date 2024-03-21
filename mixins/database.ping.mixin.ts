'use strict';

import _ from 'lodash';
const DbService = require('@moleculer/database').Service;
import config from '../knexfile';
import Moleculer, { Context, Errors } from 'moleculer';

function throwDBNotAvailableError(): Errors.MoleculerError {
  throw new Moleculer.Errors.MoleculerClientError('Database not avialable', 503, 'NO_AVAILABLE');
}
export default function (opts: any = {}) {
  const adapter: any = {
    type: 'Knex',
    options: {
      knex: config,
    },
  };

  opts = _.defaultsDeep(opts, { adapter }, { createRest: false });

  const schema = {
    mixins: [DbService(opts)],

    async started() {
      await this.getAdapter();
    },
    methods: {
      async pingDb(ctx: Context) {
        try {
          const adapter = await this.getAdapter(ctx);
          const knex = adapter.client;
          console.log('BEFORE');
          const result = await knex.raw('SELECT 1 as ping');
          console.log('AFTER');
          const ping = result?.rows[0]?.ping == 1;
          console.log('AFTER PING', ping);

          if (!ping) {
            throwDBNotAvailableError();
          }
        } catch (e) {
          throwDBNotAvailableError();
        }
      },
    },
  };

  return schema;
}
