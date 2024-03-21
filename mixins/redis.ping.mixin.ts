'use strict';
import Moleculer, { Context, Errors } from 'moleculer';

function throwCacherUnreachableError(): Errors.MoleculerError {
  throw new Moleculer.Errors.MoleculerClientError('Cacher is unreachable', 503, 'NO_AVAILABLE');
}

export default function () {
  const schema = {
    async started() {
      try {
        await this.broker.cacher.set('ping', 1);
      } catch (error) {
        this.logger.error(error);
      }
    },
    methods: {
      async pingCacher(ctx: Context) {
        try {
          const pingResponse = await this.broker.cacher.get('ping');
          if (pingResponse != 1) {
            throwCacherUnreachableError();
          }
        } catch (error) {
          throwCacherUnreachableError();
        }
      },
    },
  };

  return schema;
}
