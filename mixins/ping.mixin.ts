'use strict';

const DbService = require('@moleculer/database').Service;
import Moleculer, { Context, Errors } from 'moleculer';

export enum PingServices {
  DATABASE = 'database',
  REDIS = 'redis',
  MINIO = 'minio',
}

function throwUnreachableError(service: string): Errors.MoleculerError {
  throw new Moleculer.Errors.MoleculerClientError(`${service} is unreachable`, 503, 'UNREACHABLE');
}

interface Params {
  dbConfig: any;
  auth?: string;
  minioServiceName?: string;
  whitelist?: PingServices[];
}

export default function ({
  dbConfig,
  auth = 'PUBLIC',
  minioServiceName = 'minio',
  whitelist = Object.values(PingServices),
}: Params) {
  const getDbOptions = () => {
    if (whitelist.includes(PingServices.DATABASE)) {
      const adapter: any = {
        type: 'Knex',
        options: {
          knex: dbConfig,
        },
      };

      return { adapter, createRest: false };
    }
  };

  const opts = getDbOptions();

  const schema = {
    mixins: [DbService(opts)],

    async started() {
      try {
        if (whitelist.includes(PingServices.REDIS)) {
          await this.broker.cacher?.set('ping', 1);
        }
      } catch (error) {
        this.logger.error(error);
      }
    },
    methods: {
      async pingDb(ctx: Context) {
        try {
          const adapter = await this.getAdapter(ctx);
          const knex = adapter.client;
          const result = await knex.raw('SELECT 1 as ping');
          const ping = result?.rows[0]?.ping == 1;
          if (!ping) {
            throwUnreachableError('Database');
          }
        } catch (e) {
          throwUnreachableError('Database');
        }
      },
      async pingRedis() {
        try {
          const pingResponse = await this.broker.cacher.get('ping');
          if (pingResponse != 1) {
            throwUnreachableError('Redis');
          }
        } catch (error) {
          throwUnreachableError('Redis');
        }
      },
      async pingMinio(ctx: Context) {
        try {
          const buckets = await ctx.call(`${minioServiceName}.listBuckets`);
          return !buckets;
        } catch (error) {
          throwUnreachableError('Minio');
        }
      },
    },
    actions: {
      ping: {
        auth,
        async handler(ctx: Context) {
          if (whitelist.includes(PingServices.DATABASE)) {
            await this.pingDb(ctx);
          }
          if (whitelist.includes(PingServices.REDIS)) {
            await this.pingRedis();
          }
          if (whitelist.includes(PingServices.MINIO)) {
            await this.pingMinio(ctx);
          }
          return {
            timestamp: Date.now(),
          };
        },
      },
    },
  };

  return schema;
}
