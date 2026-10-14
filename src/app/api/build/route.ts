import { NextRequest, NextResponse } from 'next/server';
import { prepareBuild } from '@/lib/builder';
import { msg } from '@/lib/messages';
import path from 'path';
import fs from 'fs';

// Il builder "sorgenti locali" scrive su disco (temp_uploads, public/downloads).
// Su deploy serverless (es. Netlify) il filesystem è di sola lettura/temporaneo,
// quindi questa feature non è disponibile: su quelle piattaforme si usa solo
// il percorso GitHub Actions (che produce l'APK).
const IS_SERVERLESS = Boolean(
  process.env.NETLIFY || process.env.AWS_REGION || process.env.VERCEL || process.env.NETLIFY_FUNCTION
);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const appName = formData.get('appName') as string;
    const appId = formData.get('appId') as string;
    const url = formData.get('url') as string;
    const primaryColor = formData.get('primaryColor') as string;
    const file = formData.get('file') as File | null;
    const lang = String(formData.get('lang') || '');

    if (!appName || !appId) {
      return NextResponse.json({ error: 'Missing appName or appId' }, { status: 400 });
    }

    if (IS_SERVERLESS) {
      return NextResponse.json({ error: msg(lang, 'serverless') }, { status: 501 });
    }

    let zipPath: string | undefined;
    if (file) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      const tempDir = path.join(process.cwd(), 'temp_uploads');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
      
      zipPath = path.join(tempDir, `${appId}.zip`);
      fs.writeFileSync(zipPath, buffer);
    }

    const result = await prepareBuild({
      appName,
      appId,
      url,
      zipPath,
      primaryColor: primaryColor || '#0070f3'
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
