import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  client: 'legacy/fetch',
  input: 'https://boundaries.biip.lt/openapi.json',
  output: 'src/utils/boundaries',
  base: 'https://boundaries.biip.lt',
});
