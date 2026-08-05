/**
 * Génère les icônes app à partir de assets/brand/icon-b-source.png :
 * - Extrait un masque binaire (noir vs vert) depuis l’export Figma/design
 * - Recadre le « b », le redimensionne en nearest-neighbor (évite le gris au downscale iOS)
 * - 2 couleurs strictes (#000000 + #C3EA4F), fond opaque (requis Apple)
 * - android-adaptive-foreground.png, favicon-expo.png, ios AppIcon
 */
import sharp from 'sharp';
import { mkdir, access } from 'fs/promises';
import { constants as fsConstants } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'assets', 'brand', 'icon-b-source.png');
const SOURCE_FALLBACK = path.join(ROOT, 'assets', 'b.png');
const OUT_ICON = path.join(ROOT, 'assets', 'b.png');
const OUT_DIR = path.join(ROOT, 'assets', 'brand');

const CANVAS = 1024;
/** Part du canvas occupée par le « b » — calibré pour limiter l’effet ombré iOS à ~60 px. */
const ICON_FILL_RATIO = 0.64;
const ADAPTIVE_SAFE_RATIO = 0.62;
const FAVICON_SIZE = 48;
const BRAND_GREEN = { r: 195, g: 234, b: 79 };
const PURE_BLACK = { r: 0, g: 0, b: 0 };
const PNG_OPTIONS = { compressionLevel: 9, effort: 10, palette: false };

function isBlackPixel(r, g, b) {
  const dg = (r - BRAND_GREEN.r) ** 2 + (g - BRAND_GREEN.g) ** 2 + (b - BRAND_GREEN.b) ** 2;
  const dk = r * r + g * g + b * b;
  return dg > dk;
}

function maskFromRaw(data, channels, width, height) {
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * channels;
      mask[y * width + x] = isBlackPixel(data[p], data[p + 1], data[p + 2]) ? 1 : 0;
    }
  }
  return mask;
}

function maskBounds(mask, width, height) {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX) throw new Error('Aucun pixel noir détecté dans la source icône');
  return { minX, minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function cropMaskToRgb(mask, fullW, bounds) {
  const { minX, minY, width, height } = bounds;
  const out = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const j = (y * width + x) * 3;
      if (mask[(minY + y) * fullW + (minX + x)]) {
        out[j] = PURE_BLACK.r;
        out[j + 1] = PURE_BLACK.g;
        out[j + 2] = PURE_BLACK.b;
      } else {
        out[j] = BRAND_GREEN.r;
        out[j + 1] = BRAND_GREEN.g;
        out[j + 2] = BRAND_GREEN.b;
      }
    }
  }
  return out;
}

async function resolveSourcePath() {
  try {
    await access(SOURCE, fsConstants.F_OK);
    return SOURCE;
  } catch {
    return SOURCE_FALLBACK;
  }
}

async function buildAppIconPng(sourcePath, fillRatio) {
  const { data, info } = await sharp(sourcePath)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const mask = maskFromRaw(data, info.channels, info.width, info.height);
  const bounds = maskBounds(mask, info.width, info.height);
  const crop = cropMaskToRgb(mask, info.width, bounds);

  const maxSide = Math.floor(CANVAS * fillRatio);
  const scale = Math.min(maxSide / bounds.width, maxSide / bounds.height);
  const newW = Math.max(1, Math.round(bounds.width * scale));
  const newH = Math.max(1, Math.round(bounds.height * scale));

  const letter = await sharp(crop, {
    raw: { width: bounds.width, height: bounds.height, channels: 3 }
  })
    .resize(newW, newH, { kernel: sharp.kernel.nearest })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 3,
      background: BRAND_GREEN
    }
  })
    .composite([{ input: letter, gravity: 'center' }])
    .png(PNG_OPTIONS)
    .toBuffer();
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const sourcePath = await resolveSourcePath();
  if (sourcePath === SOURCE_FALLBACK) {
    console.warn('WARN: assets/brand/icon-b-source.png absent — fallback assets/b.png');
  }

  const appIcon = await buildAppIconPng(sourcePath, ICON_FILL_RATIO);

  await sharp(appIcon).png(PNG_OPTIONS).toFile(OUT_ICON);

  const maxSide = Math.floor(CANVAS * ADAPTIVE_SAFE_RATIO);
  const resized = await sharp(appIcon)
    .resize(maxSide, maxSide, { fit: 'inside', kernel: sharp.kernel.nearest })
    .png(PNG_OPTIONS)
    .toBuffer();

  const meta = await sharp(resized).metadata();
  const newW = meta.width ?? maxSide;
  const newH = meta.height ?? maxSide;
  const left = Math.floor((CANVAS - newW) / 2);
  const top = Math.floor((CANVAS - newH) / 2);

  const adaptivePath = path.join(OUT_DIR, 'android-adaptive-foreground.png');
  await sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 3,
      background: BRAND_GREEN
    }
  })
    .composite([{ input: resized, left, top }])
    .png(PNG_OPTIONS)
    .toFile(adaptivePath);

  const faviconPath = path.join(OUT_DIR, 'favicon-expo.png');
  await sharp(appIcon)
    .resize(FAVICON_SIZE, FAVICON_SIZE, {
      fit: 'contain',
      background: BRAND_GREEN,
      kernel: sharp.kernel.nearest
    })
    .png(PNG_OPTIONS)
    .toFile(faviconPath);

  const iosAppIconPath = path.join(
    ROOT,
    'ios',
    'Bloomi',
    'Images.xcassets',
    'AppIcon.appiconset',
    'App-Icon-1024x1024@1x.png'
  );
  try {
    await access(path.dirname(iosAppIconPath), fsConstants.F_OK);
    await sharp(appIcon).png(PNG_OPTIONS).toFile(iosAppIconPath);
    console.log('OK:', iosAppIconPath);
  } catch {
    // Pas de dossier ios/.
  }

  console.log('OK:', OUT_ICON);
  console.log('OK:', adaptivePath);
  console.log('OK:', faviconPath);
  console.log('Source:', sourcePath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
