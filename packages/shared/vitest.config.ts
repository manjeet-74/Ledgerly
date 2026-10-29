import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The external drive this project lives on creates macOS "AppleDouble"
    // shadow files (`._foo.ts` next to every `foo.ts`) that match a naive
    // glob; exclude them explicitly.
    include: ['src/**/[!._]*.test.ts'],
  },
});
