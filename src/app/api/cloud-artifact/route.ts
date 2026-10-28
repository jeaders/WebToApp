import { NextRequest, NextResponse } from 'next/server';
import { octo, serverConfig, getRun, listRunArtifacts, downloadArtifactZip } from '@/lib/github';
import { msg } from '@/lib/messages';
import AdmZip from 'adm-zip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Served = { body: Uint8Array<ArrayBuffer>; filename: string };

/**
 * Scarica l'APK dall'artefatto della run indicata.
 * Usato sia dal POST (dashboard) sia dal GET (link/QR code).
 */
async function loadApk(
  token: string,
  repo: string,
  runId: number,
  lang?: string
): Promise<{ error: NextResponse } | { ok: Served }> {
  const [owner, repoName] = String(repo).split('/');
  if (!owner || !repoName) {
    return { error: NextResponse.json({ error: msg(lang, 'badRepo') }, { status: 400 }) };
  }
  const octokit = octo(token);

  const run = await getRun(octokit, owner, repoName, runId);
  if (run.status !== 'completed' || run.conclusion !== 'success') {
    return {
      error: NextResponse.json(
        { error: msg(lang, 'notReady'), status: run.status, conclusion: run.conclusion },
        { status: 409 }
      ),
    };
  }

  const arts = await listRunArtifacts(octokit, owner, repoName, runId);
  const art = arts.find((a) => !a.expired) || arts[0];
  if (!art) {
    return { error: NextResponse.json({ error: msg(lang, 'noArtifact') }, { status: 404 }) };
  }

  const zipBuf = await downloadArtifactZip(token, art.archive_download_url);
  const zip = new AdmZip(zipBuf);
  const apkEntry = zip.getEntries().find((e) => !e.isDirectory && /\.apk$/i.test(e.entryName));
  if (!apkEntry) {
    return { error: NextResponse.json({ error: msg(lang, 'noArtifact') }, { status: 404 }) };
  }

  return {
    ok: {
      body: new Uint8Array(apkEntry.getData()),
      filename: /\.aab$/i.test(apkEntry.entryName)
        ? `${art.name || 'app'}.aab`
        : `${art.name || 'app'}.apk`,
    },
  };
}

function apkResponse({ body, filename }: Served, download: boolean) {
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
      'Content-Length': String(body.length),
      'Cache-Control': 'no-store',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const { token: bodyToken, repo: bodyRepo, runId, lang } = await req.json();
    const server = serverConfig();
    const token = bodyToken || server.token;
    const repo = bodyRepo || server.repo;
    if (!token || !repo || !runId) {
      return NextResponse.json({ error: msg(lang, 'missingParams') }, { status: 400 });
    }

    const result = await loadApk(token, repo, Number(runId), lang);
    if ('error' in result) return result.error;
    return apkResponse(result.ok, true);
  } catch (error: any) {
    console.error('cloud-artifact error:', error);
    return NextResponse.json(
      { error: error?.response?.data?.message || error?.message || 'Error downloading APK' },
      { status: 500 }
    );
  }
}

/**
 * GET: usato dal QR code / link diretto.
 * La configurazione server (token del proprietario) resta lato server.
 */
export async function GET(req: NextRequest) {
  try {
    const runId = Number(req.nextUrl.searchParams.get('runId') || 0);
    const repoParam = req.nextUrl.searchParams.get('repo') || '';
    const server = serverConfig();
    const repo = repoParam || server.repo;
    if (!server.token || !repo || !runId) {
      return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 });
    }

    const result = await loadApk(server.token, repo, runId);
    if ('error' in result) return result.error;
    return apkResponse(result.ok, false);
  } catch (error: any) {
    console.error('cloud-artifact GET error:', error);
    return NextResponse.json(
      { error: error?.response?.data?.message || error?.message || 'Error downloading APK' },
      { status: 500 }
    );
  }
}
