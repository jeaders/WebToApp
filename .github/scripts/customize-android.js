/**
 * Applica versione, build number e User-Agent all'app Capacitor appena generata.
 * Eseguito dal workflow subito dopo `npx cap add android`.
 *
 * Variabili d'ambiente:
 *   APP_VERSION     versionName (es. "0.1" o "1.2.3")
 *   APP_BUILD       versionCode (intero positivo)
 *   APP_USER_AGENT  stringa aggiunta allo User-Agent della WebView
 */
const fs = require('fs');
const path = require('path');

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

const versionName = sanitizeVersion(process.env.APP_VERSION);
const versionCode = sanitizeBuild(process.env.APP_BUILD);
const userAgent =
  String(process.env.APP_USER_AGENT || '').trim() || `WebToApp/${versionName} (Android)`;

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
/* 2. User-Agent personalizzato in MainActivity.java                   */
/* ------------------------------------------------------------------ */
function findFile(dir, name) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(full, name);
      if (found) return found;
    } else if (entry.name === name) {
      return full;
    }
  }
  return null;
}

const javaRoot = 'android/app/src/main/java';
const mainActivity = fs.existsSync(javaRoot) ? findFile(javaRoot, 'MainActivity.java') : null;

if (!mainActivity) {
  console.log('MainActivity.java non trovato: User-Agent non applicato.');
  process.exit(0);
}

let java = fs.readFileSync(mainActivity, 'utf8');

if (java.includes('setUserAgentString')) {
  console.log('User-Agent già presente: nessuna modifica.');
} else {
  const onCreate = /super\.onCreate\([^)]*\);/;
  if (!onCreate.test(java)) {
    console.log('onCreate non trovato: User-Agent non applicato.');
    process.exit(0);
  }

  const literal = JSON.stringify(userAgent);
  const snippet =
    `\n        android.webkit.WebSettings wtaSettings = this.getBridge().getWebView().getSettings();\n` +
    `        String wtaBaseUa = wtaSettings.getUserAgentString();\n` +
    `        wtaSettings.setUserAgentString((wtaBaseUa == null ? "" : wtaBaseUa + " ") + ${literal});\n`;

  java = java.replace(onCreate, (match) => match + snippet);
  fs.writeFileSync(mainActivity, java);
  console.log(`User-Agent impostato in ${mainActivity}: ${userAgent}`);
}
