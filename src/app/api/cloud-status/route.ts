import { NextRequest, NextResponse } from 'next/server';
import { octo, getRun, listRunArtifacts } from '@/lib/github';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { token, repo, runId } = await req.json();
    if (!token || !repo || !runId) {
      return NextResponse.json({ error: 'Parametri mancanti (token, repo, runId).' }, { status: 400 });
    }
    const [owner, repoName] = String(repo).split('/');
    const octokit = octo(token);
    const run = await getRun(octokit, owner, repoName, Number(runId));

    let artifact: { id: number; name: string } | null = null;
    if (run.status === 'completed') {
      const arts = await listRunArtifacts(octokit, owner, repoName, Number(runId));
      const first = arts.find((a) => !a.expired) || arts[0];
      if (first) artifact = { id: first.id, name: first.name };
    }

    return NextResponse.json({
      status: run.status, // queued | in_progress | completed
      conclusion: run.conclusion, // success | failure | cancelled | null
      htmlUrl: run.html_url,
      artifact,
    });
  } catch (error: any) {
    console.error('cloud-status error:', error);
    return NextResponse.json(
      { error: error?.response?.data?.message || error?.message || 'Errore stato build' },
      { status: 500 }
    );
  }
}
