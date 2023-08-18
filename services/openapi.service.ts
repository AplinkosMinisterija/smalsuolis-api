'use strict';

import Openapi from 'moleculer-auto-openapi';
import moleculer from 'moleculer';
import { Service } from 'moleculer-decorators';

@Service({
  name: 'openapi',
  mixins: [Openapi],
  settings: {
    schemaPath: '/tools/openapi/openapi.json',
    uiPath: '/tools/openapi/ui',
    assetsPath: '/tools/openapi/assets',
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
  actions: {
    generateDocs: {
      rest: 'GET /openapi.json',
    },
    ui: {
      rest: 'GET /ui',
    },
    assets: {
      rest: 'GET /assets/:file',
    },
  },
})
export default class OpenapiService extends moleculer.Service {}
