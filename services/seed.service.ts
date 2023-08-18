'use strict';

import moleculer, { Context, ServiceBroker } from 'moleculer';
import { Action, Method, Service } from 'moleculer-decorators';
import { User } from './users.service';
const fs = require('fs');

@Service({
  name: 'seed',
})
export default class SeedService extends moleculer.Service {
  @Action()
  async real(ctx: Context<Record<string, unknown>>) {
    const usersCount: number = await ctx.call('users.count');

    if (!usersCount) {
      const data: any[] = await ctx.call('auth.getSeedData');

      for (const item of data) {
        const user: User = await ctx.call('users.findOrCreate', {
          authUser: item,
          update: true,
        });
      }
    }

    return true;
  }

  @Action()
  async fake(ctx: Context<Record<string, unknown>>) {}

  @Action()
  run() {
    return this.broker.waitForServices(['auth', 'users']).then(async () => {
      await this.broker.call('seed.real', {}, { timeout: 120 * 1000 });
    });
  }
}
