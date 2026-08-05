/**
 * Génère les assets splash Bloomi :
 * - splash-screen.png : image plein écran (fond #C3EA4F + logo centré, non croppé)
 * - iOS SplashScreenLegacy.imageset (@1x/@2x/@3x) si dossier ios/ présent
 */
import sharp from 'sharp';
import { access } from 'fs/promises';
import { constants as fsConstants } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const LOGO = path.join(ROOT, 'assets', 'brand', 'logo-bloomi.png');
const SPLASH_FULL = path.join(ROOT, 'assets', 'brand', 'splash-screen.png');
const SPLASH_BG = '#C3EA4F';

/** Canvas splash plein écran (ratio proche des phones actuels) */
const SPLASH_WIDTH = 1290;
const SPLASH_HEIGHT = 2796;
/** Logo ≈ 52 % de la largeur écran — marges confortables, pas de crop */
const LOGO_WIDTH_RATIO = 0.52;

const IOS_SPLASH_DIR = path.join(
  ROOT,
  'ios',
  'Bloomi',
  'Images.xcassets',
  'SplashScreenLegacy.imageset'
);

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  };
}

async function buildSplashPng(width, height) {
  const logoMeta = await sharp(LOGO).metadata();
  const logoAspect = (logoMeta.width ?? 1) / (logoMeta.height ?? 1);
  const logoWidth = Math.round(width * LOGO_WIDTH_RATIO);
  const logoHeight = Math.round(logoWidth / logoAspect);

  const logoBuffer = await sharp(LOGO)
    .resize(logoWidth, logoHeight, { fit: 'contain' })
    .png()
    .toBuffer();

  const left = Math.round((width - logoWidth) / 2);
  const top = Math.round((height - logoHeight) / 2);
  const bg = hexToRgb(SPLASH_BG);

  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: bg
    }
  })
    .composite([{ input: logoBuffer, left, top }])
    .png()
    .toBuffer();
}

async function main() {
  const fullBuffer = await buildSplashPng(SPLASH_WIDTH, SPLASH_HEIGHT);
  await sharp(fullBuffer).toFile(SPLASH_FULL);
  console.log('OK:', path.relative(ROOT, SPLASH_FULL), `${SPLASH_WIDTH}x${SPLASH_HEIGHT}`);

  const iosExists = await access(IOS_SPLASH_DIR, fsConstants.F_OK)
    .then(() => true)
    .catch(() => false);

  if (!iosExists) {
    console.log('Skip iOS SplashScreenLegacy (no ios/ folder). Prebuild utilisera splash-screen.png.');
    return;
  }

  const ios1 = await buildSplashPng(SPLASH_WIDTH / 3, SPLASH_HEIGHT / 3);
  const ios2 = await buildSplashPng((SPLASH_WIDTH / 3) * 2, (SPLASH_HEIGHT / 3) * 2);
  const ios3 = fullBuffer;

  await sharp(ios1).toFile(path.join(IOS_SPLASH_DIR, 'image.png'));
  await sharp(ios2).toFile(path.join(IOS_SPLASH_DIR, 'image@2x.png'));
  await sharp(ios3).toFile(path.join(IOS_SPLASH_DIR, 'image@3x.png'));

  console.log('OK: iOS SplashScreenLegacy.imageset');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
