import { NextRequest, NextResponse } from 'next/server';
import { octo, serverConfig, listRunArtifacts } from '@/lib/github';
import { msg } from '@/lib/messages';

export const runtime = 'nodejs';

const WORKFLOW_ID = 'build.yml';

export async function POST(req: NextRequest) {
  try {
    const { token: bodyToken, repo: bodyRepo, branch, buildToken, lang } = await req.json();
    const server = serverConfig();
    const token = bodyToken || server.token;
    const repo = bodyRepo || server.repo;
    if (!token || !repo || !branch) {
      return NextResponse.json({ error: msg(lang, 'missingParams') }, { status: 400 });
    }
    const [owner, repoName] = String(repo).split('/');
    if (!owner || !repoName) {
      return NextResponse.json({ error: msg(lang, 'badRepo') }, { status: 400 });
    }
    const octokit = octo(token);

    // Ogni build porta un token univoco nel run-name (run: webtoapp-<token>).
    // Le API di GitHub non espongono gli input ma espongono run.name: così anche
    // con decine di build simultanee ogni visitatore traccia solo la propria.
    const { data } = await octokit.request(
      'GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs',
      {
        owner,
        repo: repoName,
        workflow_id: WORKFLOW_ID,
        event: 'workflow_dispatch',
        per_page: 30,
        headers: { 'X-GitHub-Api-Version': '2022-11-28' },
      }
    );
    const runs = data.workflow_runs || [];
    const marker = buildToken ? `webtoapp-${buildToken}` : '';
    const match = marker
      ? runs.find((r: { name?: string | null }) => !!r.name && r.name.includes(marker))
      : undefined;
    // Senza token (client vecchi): fallback "la run più recente del branch".
    const run = match || runs.find((r: { head_branch?: string | null; event?: string }) => r.head_branch === branch);

    if (!run) {
      return NextResponse.json({ runId: null, branch, buildToken: buildToken ?? null });
    }

    let artifact: { id: number; name: string } | null = null;
    if (run.status === 'completed') {
      const arts = await listRunArtifacts(octokit, owner, repoName, run.id);
      const first = arts.find((a) => !a.expired) || arts[0];
      if (first) artifact = { id: first.id, name: first.name };
    }

    return NextResponse.json({
      branch,
      runId: run.id,
      runNumber: run.run_number,
      status: run.status, // queued | in_progress | completed
      conclusion: run.conclusion, // success | failure | null
      runName: run.name,
      htmlUrl: run.html_url,
      createdAt: run.created_at,
      artifact,
    });
  } catch (error: any) {
    console.error('cloud-latest error:', error);
    return NextResponse.json(
      { error: error?.response?.data?.message || error?.message || 'Error fetching run' },
      { status: 500 }
    );
  }
}
