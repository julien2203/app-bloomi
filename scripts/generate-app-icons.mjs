/**
 * Génère les variantes d’icônes à partir de assets/b.png :
 * - android-adaptive-foreground.png : 1024×1024, logo centré dans la zone sûre (~56 %)
 *   pour éviter le zoom/crop agressif des adaptive icons Android.
 * - favicon-expo.png : 48×48 pour l’onglet navigateur (Expo web).
 * - ios/.../App-Icon-1024x1024@1x.png : copie utilisée par les builds EAS quand le dossier ios/ est versionné
 *   (sans ça, app.json seul ne met pas à jour l’icône TestFlight).
 */
import sharp from 'sharp';
import { mkdir, access } from 'fs/promises';
import { constants as fsConstants } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'assets', 'b.png');
const OUT_DIR = path.join(ROOT, 'assets', 'brand');

const ADAPTIVE_SIZE = 1024;
/** Ratio max du côté du logo par rapport au canvas (zone sûre adaptive icon ~66 % cercle). Plus haut = logo plus grand, risque de léger crop sur certains launchers. */
const ADAPTIVE_SAFE_RATIO = 0.62;
const FAVICON_SIZE = 48;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const meta = await sharp(SOURCE).metadata();
  const w = meta.width ?? ADAPTIVE_SIZE;
  const h = meta.height ?? ADAPTIVE_SIZE;
  const maxSide = Math.floor(ADAPTIVE_SIZE * ADAPTIVE_SAFE_RATIO);
  const scale = Math.min(maxSide / w, maxSide / h);
  const newW = Math.max(1, Math.round(w * scale));
  const newH = Math.max(1, Math.round(h * scale));

  const resized = await sharp(SOURCE)
    .resize(newW, newH, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();

  const left = Math.floor((ADAPTIVE_SIZE - newW) / 2);
  const top = Math.floor((ADAPTIVE_SIZE - newH) / 2);

  const adaptivePath = path.join(OUT_DIR, 'android-adaptive-foreground.png');
  await sharp({
    create: {
      width: ADAPTIVE_SIZE,
      height: ADAPTIVE_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toFile(adaptivePath);

  const faviconPath = path.join(OUT_DIR, 'favicon-expo.png');
  await sharp(SOURCE)
    .resize(FAVICON_SIZE, FAVICON_SIZE, { fit: 'contain', background: '#121212' })
    .png()
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
    await sharp(SOURCE).png().toFile(iosAppIconPath);
    console.log('OK:', iosAppIconPath);
  } catch {
    // Pas de dossier ios/ (ex. managed sans prebuild) : rien à faire.
  }

  console.log('OK:', adaptivePath);
  console.log('OK:', faviconPath);
}


main().catch((e) => {
  console.error(e);
  process.exit(1);
});
