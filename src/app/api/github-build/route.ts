import { NextRequest, NextResponse } from 'next/server';
import {
  octo,
  serverConfig,
  workflowExists,
  ensureBranchFrom,
  commitFile,
  dispatchWorkflow,
  recentRunStats,
} from '@/lib/github';
import { msg } from '@/lib/messages';

export const runtime = 'nodejs';

const WORKFLOW_ID = 'build.yml';

// Limiti anti-abuso (proteggono la quota GitHub Actions del proprietario).
const MAX_ACTIVE_RUNS = 2; // build in corso contemporaneamente
const MAX_RUNS_PER_HOUR = 40; // build avviate nell'ultima ora (tutti i visitatori)

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

    if (ct.includes('multipart/form-data')) {
      const fd = await req.formData();
      token = String(fd.get('token') || '');
      repo = String(fd.get('repo') || '');
      appName = String(fd.get('appName') || '');
      appId = String(fd.get('appId') || '');
      url = String(fd.get('url') || '');
      branch = String(fd.get('branch') || 'main') || 'main';
      lang = String(fd.get('lang') || 'en');
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

    if (file) {
      // --- Modalità ZIP: committa lo zip su un branch di build e compila da lì ---
      if (file.size > 45 * 1024 * 1024) {
        return NextResponse.json({ error: msg(lang, 'tooBig') }, { status: 413 });
      }
      const bytes = Buffer.from(await file.arrayBuffer());
      const base64 = bytes.toString('base64');
      const buildBranch = 'ci-build';
      const zipPath = 'builds/site.zip';

      await ensureBranchFrom(octokit, owner, repoName, buildBranch, branch);
      await commitFile(
        octokit,
        owner,
        repoName,
        buildBranch,
        zipPath,
        base64,
        `WebToApp: upload site ${appId || ''}`.trim()
      );
      await dispatchWorkflow(octokit, owner, repoName, WORKFLOW_ID, buildBranch, {
        app_name: appName,
        app_id: appId,
        web_url: url,
        site_zip: zipPath,
      });
      // Rispondiamo subito: su ambienti serverless (Netlify) le funzioni hanno
      // un timeout breve. Lo stato viene recuperato da /api/cloud-latest.
      return NextResponse.json({
        success: true,
        mode: 'zip',
        branch: buildBranch,
        repo: `${owner}/${repoName}`,
        message: 'Build avviata dal tuo ZIP.',
      });
    }

    // --- Modalità URL ---
    await dispatchWorkflow(octokit, owner, repoName, WORKFLOW_ID, branch, {
      app_name: appName,
      app_id: appId,
      web_url: url,
      site_zip: '',
    });
    return NextResponse.json({
      success: true,
      mode: 'url',
      branch,
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
