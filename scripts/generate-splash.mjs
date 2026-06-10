/**
 * Aligne le splash natif iOS sur app/onboarding/splash.tsx :
 * fond #C3EA4F + logo-bloomi centré (~280pt de large).
 */
import sharp from 'sharp';
import { access } from 'fs/promises';
import { constants as fsConstants } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const LOGO = path.join(ROOT, 'assets', 'brand', 'logo-bloomi.png');
const SPLASH_BG = '#C3EA4F';
/** Même taille que onboarding/splash.tsx (styles.logoImage.width) */
const LOGO_WIDTH_1X = 280;

const IOS_SPLASH_DIR = path.join(
  ROOT,
  'ios',
  'Bloomi',
  'Images.xcassets',
  'SplashScreenLegacy.imageset'
);

async function writeLogoPng(targetPath, widthPx) {
  await sharp(LOGO)
    .resize(widthPx, widthPx, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(targetPath);
}

async function main() {
  const iosExists = await access(IOS_SPLASH_DIR, fsConstants.F_OK)
    .then(() => true)
    .catch(() => false);

  if (!iosExists) {
    console.log('Skip iOS splash images (no ios/ folder). app.json + expo-splash-screen plugin apply on prebuild.');
    return;
  }

  await writeLogoPng(path.join(IOS_SPLASH_DIR, 'image.png'), LOGO_WIDTH_1X);
  await writeLogoPng(path.join(IOS_SPLASH_DIR, 'image@2x.png'), LOGO_WIDTH_1X * 2);
  await writeLogoPng(path.join(IOS_SPLASH_DIR, 'image@3x.png'), LOGO_WIDTH_1X * 3);

  console.log('OK: iOS SplashScreenLegacy.imageset (logo', LOGO_WIDTH_1X, 'pt @1x)');
  console.log('Background:', SPLASH_BG, '(SplashScreenBackground.colorset + app.json)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
