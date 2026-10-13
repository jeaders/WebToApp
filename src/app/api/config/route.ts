import { NextResponse } from 'next/server';
import { serverConfig, hasServerConfig } from '@/lib/github';

export const runtime = 'nodejs';

// Dice al front-end se la build cloud è preconfigurata lato server.
// NON espone mai il token: restituisce solo un booleano + il repo (non segreto).
export async function GET() {
  const configured = hasServerConfig();
  const { repo } = serverConfig();
  return NextResponse.json({ configured, repo: configured ? repo : null });
}
