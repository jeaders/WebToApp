import { NextRequest, NextResponse } from 'next/server';
import dns from 'node:dns/promises';
import net from 'node:net';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Dice se un sito può essere mostrato dentro un <iframe>.
 *
 * Molti siti inviano `X-Frame-Options: DENY` oppure una CSP con
 * `frame-ancestors 'none'`: in quel caso il browser mostra un iframe vuoto.
 * In quel caso la dashboard usa un'anteprima statica (screenshot).
 *
 * La richiesta è protetta da SSRF: solo http/https e niente host privati.
 */

const TIMEOUT_MS = 8000;

function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const p = address.split('.').map(Number);
    if (p[0] === 0 || p[0] === 10 || p[0] === 127) return true;
    if (p[0] === 169 && p[1] === 254) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true;
    if (p[0] >= 224) return true;
    return false;
  }
  const a = address.toLowerCase();
  if (a === '::1' || a === '::') return true;
  if (a.startsWith('::ffff:')) return isPrivateAddress(a.slice(7));
  if (a.startsWith('fc') || a.startsWith('fd')) return true;
  if (a.startsWith('fe80')) return true;
  return false;
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('URL non valido');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Protocollo non supportato');
  }
  const host = url.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.home.arpa')
  ) {
    throw new Error('Host non consentito');
  }
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new Error('Host non consentito');
  } else {
    let addrs: { address: string }[] = [];
    try {
      addrs = await dns.lookup(host, { all: true, verbatim: true });
    } catch {
      throw new Error('Host non raggiungibile');
    }
    if (!addrs.length) throw new Error('Host non raggiungibile');
    for (const a of addrs) if (isPrivateAddress(a.address)) throw new Error('Host non consentito');
  }
  return url;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url') || '';
  if (!raw) {
    return NextResponse.json({ embeddable: false, reason: 'missing-url' }, { status: 400 });
  }

  try {
    const url = await assertPublicUrl(raw);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'user-agent':
            'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) ' +
            'Chrome/126.0.0.0 Mobile Safari/537.36 WebToApp/1.0',
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        cache: 'no-store',
      });
    } finally {
      clearTimeout(timer);
    }

    // Non serve il corpo: chiudiamo subito la connessione.
    res.body?.cancel().catch(() => undefined);

    if (!res.ok && res.status >= 400) {
      return NextResponse.json({ embeddable: false, reason: `http-${res.status}` });
    }

    const xfo = (res.headers.get('x-frame-options') || '').toLowerCase();
    const csp = (res.headers.get('content-security-policy') || '').toLowerCase();
    const ancestors = /frame-ancestors\s+([^;]+)/.exec(csp)?.[1]?.trim() || '';
    const ourOrigin = req.nextUrl.origin.toLowerCase();

    let embeddable = true;
    let reason = '';

    if (xfo.includes('deny') || xfo.includes('sameorigin')) {
      embeddable = false;
      reason = `x-frame-options: ${xfo}`;
    }

    if (ancestors) {
      const allowed =
        ancestors.includes('*') ||
        ancestors.includes(ourOrigin) ||
        ancestors
          .split(/\s+/)
          .some((part) => part.replace(/^https?:\/\//, '') === req.nextUrl.host.toLowerCase());
      if (!allowed) {
        embeddable = false;
        reason = `csp frame-ancestors: ${ancestors}`;
      }
    }

    return NextResponse.json({ embeddable, reason, status: res.status });
  } catch (error: any) {
    return NextResponse.json({
      embeddable: false,
      reason: error?.name === 'AbortError' ? 'timeout' : error?.message || 'unreachable',
    });
  }
}
