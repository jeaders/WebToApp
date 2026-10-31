import { NextRequest, NextResponse } from 'next/server';
import {
  octo,
  serverConfig,
  workflowExists,
  commitFile,
  dispatchWorkflow,
  recentRunStats,
} from '@/lib/github';
import { msg } from '@/lib/messages';

export const runtime = 'nodejs';

const WORKFLOW_ID = 'build.yml';

// Contents API: due utenti che committano lo stesso file nello stesso istante
// fanno fallire il PUT con un 409. Un singolo retry ricalcando lo sha corrente
// recupera quasi tutti questi casi senza bloccare l'utente.
async function commitFileWithRetry(
  octokit: ReturnType<typeof octo>,
  owner: string,
  repo: string,
  branch: string,
  path: string,
  contentBase64: string,
  message: string
): Promise<string | undefined> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return (await commitFile(octokit, owner, repo, branch, path, contentBase64, message)) || undefined;
    } catch (e: any) {
      const status = e?.status ?? e?.response?.status;
      if ((status === 409 || status === 422) && attempt < 2) {
        await new Promise((r) => setTimeout(r, 500 + attempt * 500));
        continue;
      }
      throw e;
    }
  }
  return undefined;
}

// Limiti anti-abuso (proteggono la quota GitHub Actions del proprietario).
const MAX_ACTIVE_RUNS = 4; // build in corso contemporaneamente
const MAX_RUNS_PER_HOUR = 40; // build avviate nell'ultima ora (tutti i visitatori)

/* ------------------------------------------------------------------ */
/* Package ID                                                          */
/* ------------------------------------------------------------------ */
// Android riconosce un'app dal package ID: due APK con lo stesso ID (e la
// stessa firma) sono la stessa app, quindi il secondo viene installato come
// "aggiornamento" e sostituisce il primo. Per questo il default fisso
// (com.yourname.app) non è più accettato: se arriva un placeholder ne
// generiamo uno diverso per ogni sito.
const PACKAGE_ID_RE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
const RESERVED_PACKAGE_IDS = new Set([
  'com.yourname.app',
  'com.tuonome.app',
  'com.webtoapp.app',
  'com.webtoapp.starter',
  'com.example.app',
]);

function packageSlug(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 30);
}

function derivePackageId(url: string, appName: string): string {
  let host = '';
  const raw = String(url || '').trim();
  if (raw) {
    try {
      host = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname;
    } catch {
      host = '';
    }
  }
  let base = packageSlug(host) || packageSlug(appName) || 'app';
  if (/^[0-9]/.test(base)) base = `app${base}`;
  const id = `com.webtoapp.${base}`;
  if (RESERVED_PACKAGE_IDS.has(id)) {
    // fallback deterministico: stesso sito -> stesso ID, così gli aggiornamenti restano possibili
    let hash = 0;
    const seed = `${raw}|${appName}`;
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
    return `com.webtoapp.${base}${String(hash).padStart(5, '0')}`;
  }
  return id;
}

function normalizeAppId(rawId: string, url: string, appName: string): string {
  const value = String(rawId || '').trim();
  if (!value || RESERVED_PACKAGE_IDS.has(value.toLowerCase())) {
    const derived = derivePackageId(url, appName);
    console.log(`Package ID automatico: "${value || '(vuoto)'}" -> "${derived}"`);
    return derived;
  }
  return value;
}


function parseRepo(repo: string): { owner: string; repo: string } | null {
  if (!repo || !repo.includes('/')) return null;
  const [owner, name] = repo.split('/');
  if (!owner || !name) return null;
  return { owner, repo: name };
}

export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get('content-type') || '';

    const server = serverConfig(); // token/repo configurati dal proprietario (env)
    let token = '';
    let repo = '';
    let appName = '';
    let appId = '';
    let url = '';
    let branch = 'main';
    let file: File | null = null;
    let lang = 'en';
    let appVersion = '';
    let appBuild = '';
    let appUserAgent = '';
    let appIcon = '';

    if (ct.includes('multipart/form-data')) {
      const fd = await req.formData();
      token = String(fd.get('token') || '');
      repo = String(fd.get('repo') || '');
      appName = String(fd.get('appName') || '');
      appId = String(fd.get('appId') || '');
      url = String(fd.get('url') || '');
      branch = String(fd.get('branch') || 'main') || 'main';
      lang = String(fd.get('lang') || 'en');
      appVersion = String(fd.get('appVersion') || '');
      appBuild = String(fd.get('appBuild') || '');
      appUserAgent = String(fd.get('appUserAgent') || '');
      appIcon = String(fd.get('appIcon') || '');
      const f = fd.get('file');
      if (f && typeof f === 'object' && 'arrayBuffer' in (f as any)) file = f as File;
    } else {
      const body = await req.json();
      token = body.token || '';
      repo = body.repo || '';
      appName = body.appName || '';
      appId = body.appId || '';
      url = body.url || '';
      branch = body.branch || 'main';
      lang = body.lang || 'en';
      appVersion = body.appVersion || '';
      appBuild = body.appBuild || '';
      appUserAgent = body.appUserAgent || '';
      appIcon = body.appIcon || '';
    }

    // Valori di default per versione / build number / user agent.
    if (!appVersion || !/^[0-9]+(\.[0-9]+){0,3}$/.test(appVersion.trim())) appVersion = '0.1';
    if (!appBuild || !/^[0-9]+$/.test(appBuild.trim())) appBuild = '1';
    appUserAgent = appUserAgent.trim().slice(0, 200);

    // Package ID: mai un placeholder, altrimenti l'app sostituirebbe quella già installata.
    appId = normalizeAppId(appId, url, appName);
    if (!PACKAGE_ID_RE.test(appId)) {
      return NextResponse.json({ error: msg(lang, 'badAppId') }, { status: 400 });
    }

    // Default dalla configurazione server: il visitatore non deve inserire nulla.
    token = token || server.token;
    repo = repo || server.repo;

    // Normalizza l'URL: aggiunge https:// se manca lo schema (evita crash della WebView).
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;

    if (!token || !repo) {
      return NextResponse.json({ error: msg(lang, 'notConfigured') }, { status: 503 });
    }
    const parsed = parseRepo(repo);
    if (!parsed) {
      return NextResponse.json({ error: msg(lang, 'badRepo') }, { status: 400 });
    }
    if (!file && !url) {
      return NextResponse.json({ error: msg(lang, 'needInput') }, { status: 400 });
    }
    const { owner, repo: repoName } = parsed;
    const octokit = octo(token);

    // Verifica workflow/Actions (errore chiaro se disattivato).
    try {
      await workflowExists(octokit, owner, repoName, WORKFLOW_ID);
    } catch (e: any) {
      if (e?.status === 404) {
        return NextResponse.json({ error: msg(lang, 'wfNotFound') }, { status: 404 });
      }
    }

    // Anti-abuso: blocca se ci sono già troppe build in corso o troppe nell'ultima ora.
    try {
      const stats = await recentRunStats(octokit, owner, repoName, WORKFLOW_ID);
      if (stats.active >= MAX_ACTIVE_RUNS || stats.lastHour >= MAX_RUNS_PER_HOUR) {
        return NextResponse.json({ error: msg(lang, 'busy') }, { status: 429 });
      }
    } catch {
      // se il controllo statistiche fallisce, proseguiamo comunque
    }

    // Icona personalizzata: il dashboard la invia come data URL. La validiamo e la
    // commettiamo perché il workflow la usi rimpiattando assets/icon.png di questo run.
    // headSha viene fissato all'ultimo commit così la run compilera ESATTAMENTE
    // i file che abbiamo committato, anche se un altro utente li sovrascrive dopo.
    let iconPath: string = '';
    let headSha: string = '';
    if (appIcon) {
      const m = /data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)/.exec(appIcon);
      const bytes = m ? Buffer.from(m[2], 'base64') : null;
      const isPng = !!bytes && bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
      const isJpeg = !!bytes && bytes[0] === 0xff && bytes[1] === 0xd8;
      const isWebp = !!bytes && bytes.length > 12 && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
      if (!bytes || bytes.length < 100 || bytes.length > 4 * 1024 * 1024 || (!isPng && !isJpeg && !isWebp)) {
        return NextResponse.json({ error: msg(lang, 'badIcon') }, { status: 400 });
      }
      const ext = isPng ? 'png' : isJpeg ? 'jpg' : 'webp';
      iconPath = `builds/app.icon.${ext}`;
      const iconCommit = await commitFileWithRetry(
        octokit,
        owner,
        repoName,
        branch,
        iconPath,
        bytes.toString('base64'),
        `WebToApp: app icon ${appId}`.trim()
      );
      if (iconCommit) headSha = iconCommit;
    }

    if (file) {
      // --- Modalità ZIP: commetto lo zip sul branch attuale e compilo da lì ---
      if (file.size > 45 * 1024 * 1024) {
        return NextResponse.json({ error: msg(lang, 'tooBig') }, { status: 413 });
      }
      const bytes = Buffer.from(await file.arrayBuffer());
      const base64 = bytes.toString('base64');
      const zipPath = 'builds/site.zip';

      const zipCommit = await commitFileWithRetry(
        octokit,
        owner,
        repoName,
        branch,
        zipPath,
        base64,
        `WebToApp: upload site ${appId || ''}`.trim()
      );
      if (zipCommit) headSha = zipCommit;
      await dispatchWorkflow(octokit, owner, repoName, WORKFLOW_ID, headSha || branch, {
        app_name: appName,
        app_id: appId,
        web_url: url,
        site_zip: zipPath,
        app_version: appVersion,
        app_build: appBuild,
        app_user_agent: appUserAgent,
        app_icon: iconPath,
      });
      // Rispondiamo subito: su ambienti serverless (Netlify) le funzioni hanno
      // un timeout breve. Lo stato viene recuperato da /api/cloud-latest.
      return NextResponse.json({
        success: true,
        mode: 'zip',
        appId,
        branch,
        headSha,
        repo: `${owner}/${repoName}`,
        message: 'Build avviata dal tuo ZIP.',
      });
    }

    // --- Modalità URL ---
    await dispatchWorkflow(octokit, owner, repoName, WORKFLOW_ID, headSha || branch, {
      app_name: appName,
      app_id: appId,
      web_url: url,
      site_zip: '',
      app_version: appVersion,
      app_build: appBuild,
      app_user_agent: appUserAgent,
      app_icon: iconPath,
    });
    return NextResponse.json({
      success: true,
      mode: 'url',
      appId,
      branch,
      headSha,
      repo: `${owner}/${repoName}`,
      message: 'Build avviata.',
    });
  } catch (error: any) {
    console.error('GitHub API Error:', error);
    const status = error?.status || 500;
    const message =
      error?.response?.data?.message || error?.message || 'Errore sconosciuto durante il trigger della build.';
    return NextResponse.json(
      { error: message },
      { status: status >= 400 && status < 600 ? status : 500 }
    );
  }
}
