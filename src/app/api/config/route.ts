import { NextResponse } from 'next/server';
import { serverConfig, hasServerConfig } from '@/lib/github';

export const runtime = 'nodejs';
// Deve restare DINAMICA: se venisse prerenderizzata, il valore "configured"
// verrebbe congelato al momento del deploy (e servito dalla cache) invece di
// riflettere le variabili d'ambiente correnti del server.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Dice al front-end se la build cloud è preconfigurata lato server.
// NON espone mai il token: restituisce solo un booleano + il repo (non segreto).
export async function GET() {
  const configured = hasServerConfig();
  const { repo } = serverConfig();
  return NextResponse.json(
    { configured, repo: configured ? repo : null },
    {
      headers: {
        // Mai cacheare: il valore dipende dalle env del server in quel momento
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
      },
    }
  );
}
