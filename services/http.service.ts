'use strict';

// @ts-ignore
import HTTPClientService from 'moleculer-http-client';

import Moleculer from 'moleculer';
import { Service } from 'moleculer-decorators';

@Service({
  name: 'http',
  mixins: [HTTPClientService],

  /**
   * Moleculer settings
   */
  settings: {
    // HTTP client settings
    httpClient: {
      // Boolean value indicating whether request should be logged or not
      logging: true,
      responseFormatter: 'body',
    },
  },
})
export default class HttpService extends Moleculer.Service {}
