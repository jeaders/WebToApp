import { NextRequest, NextResponse } from 'next/server';
import {
  octo,
  workflowExists,
  ensureBranchFrom,
  commitFile,
  dispatchWorkflow,
  latestRun,
} from '@/lib/github';

export const runtime = 'nodejs';
export const maxDuration = 60;

const WORKFLOW_ID = 'build.yml';

function parseRepo(repo: string): { owner: string; repo: string } | null {
  if (!repo || !repo.includes('/')) return null;
  const [owner, name] = repo.split('/');
  if (!owner || !name) return null;
  return { owner, repo: name };
}

export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get('content-type') || '';

    let token = '';
    let repo = '';
    let appName = '';
    let appId = '';
    let url = '';
    let branch = 'main';
    let file: File | null = null;

    if (ct.includes('multipart/form-data')) {
      const fd = await req.formData();
      token = String(fd.get('token') || '');
      repo = String(fd.get('repo') || '');
      appName = String(fd.get('appName') || '');
      appId = String(fd.get('appId') || '');
      url = String(fd.get('url') || '');
      branch = String(fd.get('branch') || 'main') || 'main';
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
    }

    if (!token || !repo) {
      return NextResponse.json({ error: 'Token o repository mancanti.' }, { status: 400 });
    }
    const parsed = parseRepo(repo);
    if (!parsed) {
      return NextResponse.json({ error: 'Formato repo non valido. Usa "utente/repository".' }, { status: 400 });
    }
    if (!file && !url) {
      return NextResponse.json({ error: 'Inserisci un URL oppure carica uno ZIP.' }, { status: 400 });
    }
    const { owner, repo: repoName } = parsed;
    const octokit = octo(token);

    // Verifica workflow/Actions (errore chiaro se disattivato).
    try {
      await workflowExists(octokit, owner, repoName, WORKFLOW_ID);
    } catch (e: any) {
      if (e?.status === 404) {
        return NextResponse.json(
          {
            error:
              'Workflow "build.yml" non trovato. Attiva Actions (Settings → Actions → Allow all) e assicurati che il file sia su main.',
          },
          { status: 404 }
        );
      }
    }

    if (file) {
      // --- Modalità ZIP: committa lo zip su un branch di build e compila da lì ---
      if (file.size > 45 * 1024 * 1024) {
        return NextResponse.json({ error: 'ZIP troppo grande (max ~45MB).' }, { status: 413 });
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
      const run = await latestRun(octokit, owner, repoName, WORKFLOW_ID, buildBranch);
      return NextResponse.json({
        success: true,
        mode: 'zip',
        runId: run?.id ?? null,
        runUrl: run?.html_url ?? null,
        message: run
          ? 'Build avviata dal tuo ZIP. Attendi il termine e scarica l\'APK.'
          : 'Build avviata dal tuo ZIP. Controlla la tab Actions.',
      });
    }

    // --- Modalità URL ---
    await dispatchWorkflow(octokit, owner, repoName, WORKFLOW_ID, branch, {
      app_name: appName,
      app_id: appId,
      web_url: url,
      site_zip: '',
    });
    const run = await latestRun(octokit, owner, repoName, WORKFLOW_ID, branch);
    return NextResponse.json({
      success: true,
      mode: 'url',
      runId: run?.id ?? null,
      runUrl: run?.html_url ?? null,
      message: run
        ? 'Build avviata. Attendi il termine e scarica l\'APK.'
        : 'Build avviata. Controlla la tab Actions.',
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
