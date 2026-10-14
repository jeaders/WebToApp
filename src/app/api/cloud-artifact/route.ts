import { NextRequest, NextResponse } from 'next/server';
import { octo, serverConfig, getRun, listRunArtifacts, downloadArtifactZip } from '@/lib/github';
import { msg } from '@/lib/messages';
import AdmZip from 'adm-zip';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { token: bodyToken, repo: bodyRepo, runId, lang } = await req.json();
    const server = serverConfig();
    const token = bodyToken || server.token;
    const repo = bodyRepo || server.repo;
    if (!token || !repo || !runId) {
      return NextResponse.json({ error: msg(lang, 'missingParams') }, { status: 400 });
    }
    const [owner, repoName] = String(repo).split('/');
    const octokit = octo(token);

    const run = await getRun(octokit, owner, repoName, Number(runId));
    if (run.status !== 'completed' || run.conclusion !== 'success') {
      return NextResponse.json(
        { error: msg(lang, 'notReady'), status: run.status, conclusion: run.conclusion },
        { status: 409 }
      );
    }

    const arts = await listRunArtifacts(octokit, owner, repoName, Number(runId));
    const art = arts.find((a) => !a.expired) || arts[0];
    if (!art) {
      return NextResponse.json({ error: msg(lang, 'noArtifact') }, { status: 404 });
    }

    const zipBuf = await downloadArtifactZip(token, art.archive_download_url);
    const zip = new AdmZip(zipBuf);
    const apkEntry = zip.getEntries().find((e) => !e.isDirectory && /\.apk$/i.test(e.entryName));
    if (!apkEntry) {
      return NextResponse.json({ error: msg(lang, 'noArtifact') }, { status: 404 });
    }
    const apk = apkEntry.getData();
    const body = new Uint8Array(apk);

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': `attachment; filename="${(art.name || 'app')}.apk"`,
        'Content-Length': String(body.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('cloud-artifact error:', error);
    return NextResponse.json(
      { error: error?.response?.data?.message || error?.message || 'Error downloading APK' },
      { status: 500 }
    );
  }
}
