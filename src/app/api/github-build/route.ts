import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from 'octokit';

export async function POST(req: NextRequest) {
  try {
    const { token, repo, appName, appId, url } = await req.json();

    if (!token || !repo) {
      return NextResponse.json({ error: 'Missing token or repo' }, { status: 400 });
    }

    const [owner, repoName] = repo.split('/');
    const octokit = new Octokit({ auth: token });

    // Trigger the workflow
    await octokit.request('POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches', {
      owner,
      repo: repoName,
      workflow_id: 'build.yml',
      ref: 'main',
      inputs: {
        app_name: appName,
        app_id: appId,
        web_url: url
      },
      headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    return NextResponse.json({ success: true, message: 'Workflow triggered' });
  } catch (error: any) {
    console.error('GitHub API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
