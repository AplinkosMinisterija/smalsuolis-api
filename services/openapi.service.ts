'use strict';

import Openapi from 'moleculer-auto-openapi';
import moleculer from 'moleculer';
import { Service } from 'moleculer-decorators';

@Service({
  name: 'openapi',
  mixins: [Openapi],
  settings: {
    schemaPath: '/openapi/openapi.json',
    uiPath: '/openapi/ui',
    assetsPath: '/openapi/assets',
    openapi: {
      info: {
        description: 'Smalsių žmonių sistema',
        version: '1.0.0',
        title: 'Smalsuolis',
      },
      tags: [],
      components: {},
    },
  },
})
export default class OpenapiService extends moleculer.Service {}
