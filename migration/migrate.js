/**
 * ============================================================================
 *  הגירת נתונים: sfarim-tabady  ➜  harav-tabady
 *  Firestore (books, orders, settings) + Storage (כל הקבצים, מבנה זהה)
 * ----------------------------------------------------------------------------
 *  מבנה זהה אחד-לאחד:  אותם מזהי מסמכים, אותם נתיבי קבצים.
 *  אין מחיקות במקור.  עדכון אוטומטי של כל קישורי ה-Storage בתוך המסמכים.
 *
 *  הרצה:
 *    node migrate.js --dry-run     # סריקה בלבד, לא כותב כלום
 *    node migrate.js               # הגירה אמיתית
 *
 *  דגלים אופציונליים:
 *    --no-storage     לדלג על העתקת קבצים (רק Firestore)
 *    --no-orders      לדלג על אוסף ההזמנות
 *    --skip-existing  לא לשכתב מסמך/קובץ שכבר קיים ביעד (ברירת מחדל: שכתוב)
 * ============================================================================
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// ---------- דגלים ----------
const ARGS = process.argv.slice(2);
const DRY_RUN       = ARGS.includes('--dry-run');
const COPY_STORAGE  = !ARGS.includes('--no-storage');
const COPY_ORDERS   = !ARGS.includes('--no-orders');
const SKIP_EXISTING = ARGS.includes('--skip-existing');

// אוספי Firestore להעתקה (אותם מזהי מסמכים נשמרים)
const COLLECTIONS = ['books', 'orders', 'settings'];

// ---------- הגדרות פרויקטים ----------
const SRC = {
  projectId: 'sfarim-tabady',
  bucket: 'sfarim-tabady.firebasestorage.app',
  keyFile: path.join(__dirname, 'keys', 'sfarim-tabady.json'),
};
const DST = {
  projectId: 'harav-tabady',
  bucket: 'harav-tabady.firebasestorage.app',
  keyFile: path.join(__dirname, 'keys', 'harav-tabady.json'),
};

// ---------- צבעים ללוג ----------
const c = {
  reset: '\x1b[0m', dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m',
  yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m', bold: '\x1b[1m',
};
const log  = (m) => console.log(m);
const ok   = (m) => console.log(c.green + '  ✓ ' + c.reset + m);
const warn = (m) => console.log(c.yellow + '  ⚠ ' + c.reset + m);
const err  = (m) => console.log(c.red + '  ✗ ' + c.reset + m);
const head = (m) => console.log('\n' + c.bold + c.cyan + m + c.reset);

// ---------- אתחול ----------
function loadKey(p, label) {
  if (!fs.existsSync(p)) {
    err(`חסר קובץ מפתח: ${p}`);
    err(`הורד Service Account JSON של ${label} מ-Firebase Console → Project Settings → Service Accounts → Generate new private key, ושמור בנתיב הזה.`);
    process.exit(1);
  }
  return require(p);
}

const srcApp = admin.initializeApp({
  credential: admin.credential.cert(loadKey(SRC.keyFile, 'sfarim-tabady')),
  storageBucket: SRC.bucket,
}, 'src');

const dstApp = admin.initializeApp({
  credential: admin.credential.cert(loadKey(DST.keyFile, 'harav-tabady')),
  storageBucket: DST.bucket,
}, 'dst');

const srcDb = srcApp.firestore();
const dstDb = dstApp.firestore();
const srcBucket = srcApp.storage().bucket();
const dstBucket = dstApp.storage().bucket();

// ספירות
const stats = { docs: 0, files: 0, urls: 0, skipped: 0, errors: 0 };

// ---------- עזרי URL ----------
// ממיר קישור הורדה של דלי המקור לקישור של דלי היעד (אותו path)
const SRC_BUCKET_TOKENS = [SRC.bucket, 'sfarim-tabady.appspot.com'];

function isSrcDownloadUrl(v) {
  return typeof v === 'string'
    && v.includes('firebasestorage.googleapis.com')
    && SRC_BUCKET_TOKENS.some(t => v.includes('/b/' + t + '/'));
}

function storagePathFromUrl(url) {
  const m = url.match(/\/o\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

// בונה קישור הורדה ציבורי ליעד (משתמש ב-token שנשמר ב-metadata, אם קיים)
async function buildDstUrl(storagePath) {
  const file = dstBucket.file(storagePath);
  try {
    const [meta] = await file.getMetadata();
    let token = meta.metadata && meta.metadata.firebaseStorageDownloadTokens;
    if (!token) {
      // יוצרים token חדש כדי שהקישור הציבורי יעבוד
      token = require('crypto').randomUUID();
      await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
    }
    const enc = encodeURIComponent(storagePath);
    return `https://firebasestorage.googleapis.com/v0/b/${DST.bucket}/o/${enc}?alt=media&token=${token}`;
  } catch (e) {
    return null;
  }
}

// עובר רקורסיבית על אובייקט ומחליף קישורי-מקור בקישורי-יעד
async function rewriteUrls(value) {
  if (isSrcDownloadUrl(value)) {
    const p = storagePathFromUrl(value);
    if (!p) return value;
    const nu = await buildDstUrl(p);
    if (nu) { stats.urls++; return nu; }
    return value;
  }
  if (Array.isArray(value)) {
    const out = [];
    for (const v of value) out.push(await rewriteUrls(v));
    return out;
  }
  if (value && typeof value === 'object' && !(value instanceof admin.firestore.Timestamp)
      && !(value instanceof admin.firestore.GeoPoint)) {
    const out = {};
    for (const k of Object.keys(value)) out[k] = await rewriteUrls(value[k]);
    return out;
  }
  return value;
}

// ---------- העתקת Storage (מבנה זהה) ----------
async function migrateStorage() {
  head('STORAGE — העתקת קבצים (מבנה נתיבים זהה)');
  const [files] = await srcBucket.getFiles();
  log(c.dim + `  נמצאו ${files.length} קבצים במקור` + c.reset);

  for (const file of files) {
    const p = file.name;
    if (DRY_RUN) { log('  [DRY] ' + p); stats.files++; continue; }

    try {
      const dstFile = dstBucket.file(p);
      if (SKIP_EXISTING) {
        const [exists] = await dstFile.exists();
        if (exists) { stats.skipped++; warn('דילוג (קיים): ' + p); continue; }
      }
      const [buf] = await file.download();
      const [meta] = await file.getMetadata();
      // שומרים token כדי שקישורי ההורדה הציבוריים יעבדו אחרי ההעתקה
      const token = (meta.metadata && meta.metadata.firebaseStorageDownloadTokens)
        || require('crypto').randomUUID();
      await dstFile.save(buf, {
        contentType: meta.contentType || undefined,
        metadata: { metadata: { firebaseStorageDownloadTokens: token } },
        resumable: false,
      });
      stats.files++;
      ok(p);
    } catch (e) {
      stats.errors++;
      err(p + ' — ' + e.message);
    }
  }
}

// ---------- העתקת Firestore ----------
async function migrateFirestore() {
  for (const col of COLLECTIONS) {
    if (col === 'orders' && !COPY_ORDERS) { warn('דילוג על orders (לפי דגל)'); continue; }
    head(`FIRESTORE — אוסף "${col}"`);
    const snap = await srcDb.collection(col).get();
    log(c.dim + `  נמצאו ${snap.size} מסמכים` + c.reset);

    for (const docSnap of snap.docs) {
      const id = docSnap.id;
      if (DRY_RUN) { log(`  [DRY] ${col}/${id}`); stats.docs++; continue; }

      try {
        const dstRef = dstDb.collection(col).doc(id);
        if (SKIP_EXISTING) {
          const existing = await dstRef.get();
          if (existing.exists) { stats.skipped++; warn(`דילוג (קיים): ${col}/${id}`); continue; }
        }
        let data = docSnap.data();
        if (COPY_STORAGE) data = await rewriteUrls(data); // עדכון קישורים רק אם העתקנו קבצים
        await dstRef.set(data);
        stats.docs++;
        ok(`${col}/${id}`);
      } catch (e) {
        stats.errors++;
        err(`${col}/${id} — ${e.message}`);
      }
    }
  }
}

// ---------- ריצה ----------
(async () => {
  console.log(c.bold + '\n════════════════════════════════════════════════════');
  console.log('  הגירה: sfarim-tabady  ➜  harav-tabady');
  console.log('  מצב: ' + (DRY_RUN ? c.yellow + 'DRY-RUN (סריקה בלבד)' : c.green + 'הגירה אמיתית') + c.reset + c.bold);
  console.log('  Storage: ' + (COPY_STORAGE ? 'כן' : 'לא') + ' | Orders: ' + (COPY_ORDERS ? 'כן' : 'לא') + ' | מצב קיים: ' + (SKIP_EXISTING ? 'דלג' : 'שכתב'));
  console.log('════════════════════════════════════════════════════' + c.reset);

  try {
    // קבצים קודם — כדי שקישורי היעד יהיו קיימים בעת עדכון מסמכי Firestore
    if (COPY_STORAGE) await migrateStorage();
    else warn('דילוג על Storage; קישורים בתוך המסמכים יישארו לבאקט הישן');

    await migrateFirestore();

    head('סיכום');
    log(`  מסמכים:   ${c.green}${stats.docs}${c.reset}`);
    log(`  קבצים:    ${c.green}${stats.files}${c.reset}`);
    log(`  קישורים:  ${c.green}${stats.urls}${c.reset} עודכנו`);
    log(`  דילוגים:  ${c.yellow}${stats.skipped}${c.reset}`);
    log(`  שגיאות:   ${stats.errors ? c.red : c.green}${stats.errors}${c.reset}`);
    if (!DRY_RUN && stats.errors === 0) log('\n' + c.green + c.bold + '  ✓ ההגירה הושלמה בהצלחה!' + c.reset);
    if (DRY_RUN) log('\n' + c.yellow + '  זו הייתה סריקה בלבד. הרץ ללא --dry-run להגירה אמיתית.' + c.reset);
  } catch (e) {
    err('שגיאה כללית: ' + e.message);
    console.error(e);
    process.exit(1);
  }
})();
