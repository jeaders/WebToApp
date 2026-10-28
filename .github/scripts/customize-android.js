/**
 * Applica versione, build number e User-Agent all'app Capacitor appena generata.
 * Eseguito dal workflow subito dopo `npx cap add android` + `npx cap sync android`.
 *
 * Variabili d'ambiente:
 *   APP_VERSION     versionName (es. "0.1" o "1.2.3")
 *   APP_BUILD       versionCode (intero positivo)
 *   APP_USER_AGENT  stringa aggiunta allo User-Agent della WebView
 *
 * Lo User-Agent usa l'opzione nativa di Capacitor `android.appendUserAgent`,
 * che viene applicata in initWebView() prima di caricare il sito: nessuna
 * patch fragile al codice Java.
 */
const fs = require('fs');

function sanitizeVersion(value) {
  const v = String(value || '').trim();
  return /^[0-9]+(\.[0-9]+){0,3}$/.test(v) ? v : '0.1';
}

function sanitizeBuild(value) {
  const digits = String(value || '').replace(/[^0-9]/g, '');
  if (!digits) return '1';
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n) || n < 1) return '1';
  return String(Math.min(n, 2100000000));
}

function sanitizeUserAgent(value, versionName) {
  const fallback = `WebToApp/${versionName} (Android)`;
  const cleaned = String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
  return cleaned || fallback;
}

const versionName = sanitizeVersion(process.env.APP_VERSION);
const versionCode = sanitizeBuild(process.env.APP_BUILD);
const userAgent = sanitizeUserAgent(process.env.APP_USER_AGENT, versionName);

/* ------------------------------------------------------------------ */
/* 1. versionName / versionCode in android/app/build.gradle            */
/* ------------------------------------------------------------------ */
const gradlePath = 'android/app/build.gradle';
if (!fs.existsSync(gradlePath)) {
  console.error(`File non trovato: ${gradlePath}`);
  process.exit(1);
}

let gradle = fs.readFileSync(gradlePath, 'utf8');
if (!/versionCode\s+\d+/.test(gradle) || !/versionName\s+"[^"]*"/.test(gradle)) {
  console.error('versionCode/versionName non trovati in android/app/build.gradle');
  process.exit(1);
}

gradle = gradle
  .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  .replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);
fs.writeFileSync(gradlePath, gradle);
console.log(`build.gradle aggiornato: versionName="${versionName}" versionCode=${versionCode}`);

/* ------------------------------------------------------------------ */
/* 2. User-Agent: android.appendUserAgent nella config Capacitor       */
/* ------------------------------------------------------------------ */
const NATIVE_CONFIG = 'android/app/src/main/assets/capacitor.config.json';

function applyUserAgent(file, { required }) {
  if (!fs.existsSync(file)) {
    if (required) {
      console.error(`Config nativa mancante: ${file} (esegui prima "npx cap sync android")`);
      process.exit(1);
    }
    console.log(`Config non trovata, salto: ${file}`);
    return false;
  }

  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    console.error(`Config non valida (${file}): ${error.message}`);
    process.exit(1);
  }

  cfg.android = { ...(cfg.android || {}), appendUserAgent: userAgent };
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
  console.log(`User-Agent impostato in ${file}: ${userAgent}`);
  return true;
}

// La config nativa è quella che l'app legge a runtime: se manca è un errore.
applyUserAgent(NATIVE_CONFIG, { required: true });
// Teniamo allineata anche la config di progetto (per sync successivi).
applyUserAgent('capacitor.config.json', { required: false });

/* ------------------------------------------------------------------ */
/* 3. Verifica finale                                                  */
/* ------------------------------------------------------------------ */
const check = JSON.parse(fs.readFileSync(NATIVE_CONFIG, 'utf8'));
if (!check?.android?.appendUserAgent) {
  console.error('Verifica fallita: android.appendUserAgent assente nella config nativa.');
  process.exit(1);
}
console.log('Verifica OK: versione, build number e User-Agent applicati.');
