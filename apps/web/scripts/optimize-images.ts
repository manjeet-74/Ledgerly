/**
 * Converts every raster image under `public/` to WebP and caps it at
 * MAX_DIMENSION on its longest side, overwriting in place. Ledgerly
 * currently ships zero raster images (icons are SVG or generated on-demand
 * via next/og) -- this script exists so the first screenshot or marketing
 * image anyone adds gets compressed automatically instead of silently
 * shipping a multi-MB PNG, which would blow the ~200KB budget for any
 * single image.
 */
import { readdir, stat } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const RASTER_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);
const MAX_DIMENSION = 1600;
const MAX_BYTES = 200 * 1024;

async function* walk(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

async function main() {
  let converted = 0;
  for await (const file of walk(PUBLIC_DIR)) {
    const ext = path.extname(file).toLowerCase();
    if (!RASTER_EXTENSIONS.has(ext)) continue;

    const outPath = file.slice(0, -ext.length) + '.webp';
    await sharp(file)
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(outPath);

    const { size } = await stat(outPath);
    console.log(`${path.relative(PUBLIC_DIR, file)} -> ${path.relative(PUBLIC_DIR, outPath)} (${Math.round(size / 1024)} KB)`);
    if (size > MAX_BYTES) {
      console.warn(`  warning: still over the ${MAX_BYTES / 1024}KB budget -- consider a smaller source image.`);
    }
    converted += 1;
  }

  if (converted === 0) {
    console.log('No raster images found under public/ -- nothing to optimize.');
  }
}

main();
