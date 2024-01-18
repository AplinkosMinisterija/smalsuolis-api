'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';

@Service({
  name: 'datagov',
  settings: {
    baseUrl: 'https://get.data.gov.lt',
  },
})
export default class DatagovService extends moleculer.Service {
  @Action()
  async infostatyba(ctx: Context) {
    const url =
      this.settings.baseUrl +
      '/datasets/gov/vtpsi/infostatyba/Statinys/:format/json';

    const response: any = await ctx.call('http.get', {
      url: `${url}?limit(2)`,
      opt: { responseType: 'json' },
    });

    return response._data;
  }
}
