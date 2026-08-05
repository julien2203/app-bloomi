/**
 * Backfill perf images pour le bucket `listings` :
 * 1) recompresse les originaux trop lourds (max 1200px) — accélère l'app déjà en prod
 * 2) génère les siblings `*.card.jpg` (640px) — pour le feed après le prochain push
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill-listing-card-images.mjs
 *   node --env-file=.env.local scripts/backfill-listing-card-images.mjs --dry-run
 *   node --env-file=.env.local scripts/backfill-listing-card-images.mjs --limit=20
 *
 * Requis:
 *   EXPO_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Options:
 *   --dry-run
 *   --limit=N
 *   --force              Recrée les .card.jpg même si présents
 *   --skip-shrink-full   Ne pas recompresser les originaux
 */
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const BUCKET = 'listings';
const FULL_MAX_EDGE = 1200;
const FULL_JPEG_QUALITY = 80;
const CARD_MAX_EDGE = 640;
const CARD_JPEG_QUALITY = 70;
const FULL_SHRINK_MIN_BYTES = 350 * 1024;
const PAGE_SIZE = 500;

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error(
    'Missing EXPO_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY'
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const skipShrinkFull = args.includes('--skip-shrink-full');
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function isCardUrl(url) {
  return /\.card\.(jpe?g|png|webp)(\?|#|$)/i.test(String(url || ''));
}

function toCardUrl(url) {
  const raw = String(url || '').trim();
  if (!raw || isCardUrl(raw)) return raw;
  return raw.replace(/\.(jpe?g|png|webp)(\?[^#]*)?(#.*)?$/i, '.card.$1$2$3');
}

function objectPathFromPublicUrl(url) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = String(url).indexOf(marker);
  if (idx === -1) return null;
  const pathAndQuery = String(url).slice(idx + marker.length);
  return decodeURIComponent(pathAndQuery.split('?')[0].split('#')[0]);
}

async function fetchAllFullPhotoUrls() {
  const urls = new Set();
  let from = 0;

  for (;;) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('listing_photos')
      .select('url')
      .range(from, to);

    if (error) throw error;
    if (!data?.length) break;

    for (const row of data) {
      const url = typeof row.url === 'string' ? row.url.trim() : '';
      if (!url || isCardUrl(url)) continue;
      if (!/\.(jpe?g|png|webp)(\?|#|$)/i.test(url)) continue;
      urls.add(url);
    }

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return [...urls];
}

async function cardExists(cardPath) {
  const folder = cardPath.includes('/') ? cardPath.slice(0, cardPath.lastIndexOf('/')) : '';
  const name = cardPath.includes('/') ? cardPath.slice(cardPath.lastIndexOf('/') + 1) : cardPath;
  const { data, error } = await supabase.storage.from(BUCKET).list(folder, {
    search: name,
    limit: 20
  });
  if (error) return false;
  return (data || []).some((f) => f.name === name);
}

async function processOne(fullUrl, index, total) {
  const fullPath = objectPathFromPublicUrl(fullUrl);
  if (!fullPath) {
    console.warn(`[skip] not a ${BUCKET} public URL: ${fullUrl}`);
    return { status: 'skip' };
  }

  const cardUrl = toCardUrl(fullUrl);
  const cardPath = objectPathFromPublicUrl(cardUrl);
  if (!cardPath) return { status: 'skip' };

  if (dryRun) {
    console.log(`[${index}/${total}] dry-run ${fullPath} → shrink? + ${cardPath}`);
    return { status: 'dry-run' };
  }

  const { data: blob, error: dlError } = await supabase.storage.from(BUCKET).download(fullPath);
  if (dlError || !blob) {
    console.warn(`[${index}/${total}] download fail ${fullPath}: ${dlError?.message}`);
    return { status: 'error' };
  }

  let working = Buffer.from(await blob.arrayBuffer());
  const originalBytes = working.length;
  let shrunkFull = false;

  try {
    const meta = await sharp(working).metadata();
    const longEdge = Math.max(meta.width || 0, meta.height || 0);
    const needsShrink =
      !skipShrinkFull &&
      (longEdge > FULL_MAX_EDGE || originalBytes > FULL_SHRINK_MIN_BYTES);

    if (needsShrink) {
      const next = await sharp(working)
        .rotate()
        .resize({
          width: FULL_MAX_EDGE,
          height: FULL_MAX_EDGE,
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: FULL_JPEG_QUALITY, mozjpeg: true })
        .toBuffer();

      if (next.length < working.length * 0.95) {
        const { error: upFullErr } = await supabase.storage.from(BUCKET).upload(fullPath, next, {
          contentType: 'image/jpeg',
          upsert: true,
          cacheControl: '31536000'
        });
        if (upFullErr) {
          console.warn(`[${index}/${total}] shrink upload fail: ${upFullErr.message}`);
        } else {
          working = next;
          shrunkFull = true;
        }
      }
    }
  } catch (err) {
    console.warn(`[${index}/${total}] sharp full fail: ${err?.message || err}`);
  }

  if (!force) {
    const exists = await cardExists(cardPath);
    if (exists) {
      console.log(
        `[${index}/${total}] card exists${shrunkFull ? ' + shrunk full' : ''} ${cardPath}`
      );
      return { status: shrunkFull ? 'ok' : 'exists' };
    }
  }

  try {
    const cardBuffer = await sharp(working)
      .rotate()
      .resize({
        width: CARD_MAX_EDGE,
        height: CARD_MAX_EDGE,
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: CARD_JPEG_QUALITY, mozjpeg: true })
      .toBuffer();

    const { error: upError } = await supabase.storage.from(BUCKET).upload(cardPath, cardBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
      cacheControl: '31536000'
    });

    if (upError) {
      console.warn(`[${index}/${total}] card upload fail ${cardPath}: ${upError.message}`);
      return { status: shrunkFull ? 'ok' : 'error' };
    }

    console.log(
      `[${index}/${total}] ok card ${Math.round(cardBuffer.length / 1024)}KB` +
        (shrunkFull
          ? ` | full ${Math.round(originalBytes / 1024)}→${Math.round(working.length / 1024)}KB`
          : '') +
        ` | ${cardPath}`
    );
  } catch (err) {
    console.warn(`[${index}/${total}] card sharp fail: ${err?.message || err}`);
    return { status: shrunkFull ? 'ok' : 'error' };
  }

  return { status: 'ok' };
}

async function main() {
  console.log(`Backfill listing images → ${supabaseUrl}`);
  console.log(
    `dryRun=${dryRun} force=${force} skipShrinkFull=${skipShrinkFull} limit=${
      Number.isFinite(limit) ? limit : '∞'
    }`
  );

  const all = await fetchAllFullPhotoUrls();
  const targets = all.slice(0, Number.isFinite(limit) ? limit : all.length);
  console.log(`Found ${all.length} full photos, processing ${targets.length}`);

  const stats = { ok: 0, exists: 0, skip: 0, error: 0, 'dry-run': 0 };

  for (let i = 0; i < targets.length; i++) {
    const result = await processOne(targets[i], i + 1, targets.length);
    stats[result.status] = (stats[result.status] || 0) + 1;
  }

  console.log('Done:', stats);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
