import { NextRequest, NextResponse } from 'next/server';
import { octo, getRun, listRunArtifacts } from '@/lib/github';

export const runtime = 'nodejs';

const WORKFLOW_ID = 'build.yml';

export async function POST(req: NextRequest) {
  try {
    const { token, repo, branch } = await req.json();
    if (!token || !repo || !branch) {
      return NextResponse.json({ error: 'Parametri mancanti (token, repo, branch).' }, { status: 400 });
    }
    const [owner, repoName] = String(repo).split('/');
    if (!owner || !repoName) {
      return NextResponse.json({ error: 'Formato repo non valido.' }, { status: 400 });
    }
    const octokit = octo(token);

    // Run workflow_dispatch più recente per questo branch
    const { data } = await octokit.request(
      'GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs',
      {
        owner,
        repo: repoName,
        workflow_id: WORKFLOW_ID,
        branch,
        event: 'workflow_dispatch',
        per_page: 5,
        headers: { 'X-GitHub-Api-Version': '2022-11-28' },
      }
    );
    const run = (data.workflow_runs || [])[0];
    if (!run) {
      return NextResponse.json({ runId: null, branch });
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
      htmlUrl: run.html_url,
      createdAt: run.created_at,
      artifact,
    });
  } catch (error: any) {
    console.error('cloud-latest error:', error);
    return NextResponse.json(
      { error: error?.response?.data?.message || error?.message || 'Errore recupero run' },
      { status: 500 }
    );
  }
}
