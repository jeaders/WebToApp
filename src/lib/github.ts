import { Octokit } from 'octokit';

const API_HEADERS = { 'X-GitHub-Api-Version': '2022-11-28' };

/**
 * Configurazione lato SERVER (variabili d'ambiente).
 * Il token NON viene MAI esposto al browser: resta solo sul server.
 * Variabili:
 *   WEBTOAPP_GITHUB_TOKEN  -> PAT con scope repo + workflow
 *   WEBTOAPP_GITHUB_REPO   -> "utente/repo" (es. jeaders/WebToApp)
 */
export function serverConfig(): { token: string; repo: string } {
  return {
    token: process.env.WEBTOAPP_GITHUB_TOKEN || process.env.WEBTOAPP_TOKEN || '',
    repo: process.env.WEBTOAPP_GITHUB_REPO || process.env.WEBTOAPP_REPO || '',
  };
}

export function hasServerConfig(): boolean {
  const c = serverConfig();
  return Boolean(c.token && c.repo);
}

export function octo(token: string) {
  return new Octokit({ auth: token });
}

/** Verifica che il workflow esista (errore 404 chiaro se Actions è spento / file assente). */
export async function workflowExists(octokit: Octokit, owner: string, repo: string, workflowId: string) {
  await octokit.request('GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}', {
    owner,
    repo,
    workflow_id: workflowId,
    headers: API_HEADERS,
  });
}

/** Porta (o crea) il branch `branch` forzandolo allo SHA di `fromBranch` (default: main). */
export async function ensureBranchFrom(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  fromBranch: string
) {
  const { data: ref } = await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
    owner,
    repo,
    ref: `heads/${fromBranch}`,
    headers: API_HEADERS,
  });
  const sha = (ref as any).object.sha as string;
  try {
    await octokit.request('PATCH /repos/{owner}/{repo}/git/refs/{ref}', {
      owner,
      repo,
      ref: `heads/${branch}`,
      sha,
      force: true,
      headers: API_HEADERS,
    });
  } catch (e: any) {
    if (e?.status === 404) {
      await octokit.request('POST /repos/{owner}/{repo}/git/refs', {
        owner,
        repo,
        ref: `refs/heads/${branch}`,
        sha,
        headers: API_HEADERS,
      });
    } else {
      throw e;
    }
  }
}

/** Crea o aggiorna un file (contenuto base64) su un branch. */
export async function commitFile(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  path: string,
  contentBase64: string,
  message: string
) {
  let sha: string | undefined;
  try {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner,
      repo,
      path,
      ref: `heads/${branch}`,
      headers: API_HEADERS,
    });
    sha = (data as any).sha;
  } catch (e: any) {
    if (e?.status !== 404) throw e;
  }

  const { data } = await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
    owner,
    repo,
    path,
    branch,
    message,
    content: contentBase64,
    ...(sha ? { sha } : {}),
    headers: API_HEADERS,
  });
  return (data as any).commit?.sha as string | undefined;
}

export async function dispatchWorkflow(
  octokit: Octokit,
  owner: string,
  repo: string,
  workflowId: string,
  ref: string,
  inputs: Record<string, string>
) {
  await octokit.request('POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches', {
    owner,
    repo,
    workflow_id: workflowId,
    ref,
    inputs,
    headers: API_HEADERS,
  });
}

/** Recupera la run più recente per branch+event (ritenta qualche secondo per dare tempo a GitHub di crearla). */
export async function latestRun(
  octokit: Octokit,
  owner: string,
  repo: string,
  workflowId: string,
  ref: string
) {
  for (let i = 0; i < 8; i++) {
    const { data } = await octokit.request(
      'GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs',
      {
        owner,
        repo,
        workflow_id: workflowId,
        branch: ref,
        event: 'workflow_dispatch',
        per_page: 5,
        headers: API_HEADERS,
      }
    );
    const run = (data.workflow_runs || [])[0];
    if (run) return run as any;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}

/** Recupera una run per id. */
export async function getRun(octokit: Octokit, owner: string, repo: string, runId: number) {
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/actions/runs/{run_id}', {
    owner,
    repo,
    run_id: runId,
    headers: API_HEADERS,
  });
  return data as any;
}

/** Lista gli artifact di una run. */
export async function listRunArtifacts(octokit: Octokit, owner: string, repo: string, runId: number) {
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts', {
    owner,
    repo,
    run_id: runId,
    headers: API_HEADERS,
  });
  return (data.artifacts || []) as any[];
}

/** Scarica lo zip di un artifact seguendo il redirect firmato (senza rimandare l'Authorization). */
export async function downloadArtifactZip(token: string, archiveUrl: string): Promise<Buffer> {
  const r1 = await fetch(archiveUrl, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    redirect: 'manual',
  } as any);
  if (r1.status >= 300 && r1.status < 400) {
    const loc = r1.headers.get('location');
    if (loc) {
      const r2 = await fetch(loc);
      if (!r2.ok) throw new Error(`Download artifact fallito (${r2.status})`);
      return Buffer.from(await r2.arrayBuffer());
    }
  }
  if (r1.ok) return Buffer.from(await r1.arrayBuffer());
  throw new Error(`Download artifact fallito (${r1.status})`);
}

/**
 * Statistiche anti-abuso: quante run workflow_dispatch sono attive ora e quante
 * sono state create nell'ultima ora. Protegge la quota Actions del proprietario
 * quando il servizio è aperto ai visitatori (token lato server).
 */
export async function recentRunStats(
  octokit: Octokit,
  owner: string,
  repo: string,
  workflowId: string
): Promise<{ active: number; lastHour: number }> {
  const { data } = await octokit.request(
    'GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs',
    {
      owner,
      repo,
      workflow_id: workflowId,
      event: 'workflow_dispatch',
      per_page: 50,
      headers: API_HEADERS,
    }
  );
  const runs = (data.workflow_runs || []) as any[];
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  let active = 0;
  let lastHour = 0;
  for (const r of runs) {
    if (r.status !== 'completed') active++;
    const created = new Date(r.created_at).getTime();
    if (!Number.isNaN(created) && created >= hourAgo) lastHour++;
  }
  return { active, lastHour };
}

/**
 * File temporanei di build nelle cartelle con token univoco (builds/runs/*).
 * Contano pochi file e sono committati su main da ogni novo deploy: senza pulizia
 * il repo cresce senza fine. Qui teniamo soltanto gli ultimi MAX_KEEP_FILE,
 * eliminando i più vecchi secondo il nome (che contiene il timestamp).
 */
export const MAX_KEEP_FILES = 16;

export async function cleanupRunFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  dir: string,
  branch: string,
  keep: number = MAX_KEEP_FILES
): Promise<void> {
  let files: { name: string; sha: string }[] = [];
  try {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner,
      repo,
      path: dir,
      ref: branch,
      headers: API_HEADERS,
    });
    files = ((data as any[]) || []).filter((f) => f.type === 'file').map((f) => ({ name: f.name, sha: f.sha }));
  } catch {
    return; // cartella ancora vuota o non esistente
  }
  if (files.length <= keep) return;
  files.sort((a, b) => a.name.localeCompare(b.name));
  for (const f of files.slice(0, files.length - keep)) {
    try {
      await octokit.request('DELETE /repos/{owner}/{repo}/contents/{path}', {
        owner,
        repo,
        path: `${dir}/${f.name}`,
        message: `WebToApp: cleanup ${dir}/${f.name}`,
        sha: f.sha,
        branch,
        headers: API_HEADERS,
      });
    } catch {
      // best effort: la pulizia non deve mai bloccare una build
    }
  }
}

export { enqueue } from '../queue/store';
