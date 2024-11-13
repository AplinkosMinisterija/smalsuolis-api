import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  client: 'legacy/fetch',
  input: 'https://boundaries.biip.lt/openapi.json',
  output: 'utils/boundaries',
  base: 'https://boundaries.biip.lt',
});
