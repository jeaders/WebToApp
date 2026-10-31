import { NextRequest, NextResponse } from 'next/server';
import { octo, serverConfig, listRunArtifacts } from '@/lib/github';
import { msg } from '@/lib/messages';

export const runtime = 'nodejs';

const WORKFLOW_ID = 'build.yml';

export async function POST(req: NextRequest) {
  try {
    const { token: bodyToken, repo: bodyRepo, branch, headSha, lang } = await req.json();
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

    // Con headSha (dispatch fissato ad un commit preciso, incluso quando il ref
    // e uno sha) GitHub non mostra davvero la run tra quelle "del branch":
    // quindi elenchiamo le ultime run del workflow e abbiniamo quella il cui
    // head_sha coincide. Ogni visitatore traccia solo la propria build anche
    // quando altri utenti costruiscono nello stesso momento.
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
    const match = runs.find(
      (r: { head_sha?: string }) => headSha && r.head_sha === headSha
    );
    // Senza headSha (client vecchi): fallback "la run più recente del branch".
    const run = match || runs.find((r: { head_branch?: string | null; event?: string }) => r.head_branch === branch);

    if (!run) {
      return NextResponse.json({ runId: null, branch, headSha: headSha ?? null });
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
      headSha: run.head_sha,
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
