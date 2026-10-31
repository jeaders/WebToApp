import { octo, serverConfig, recentRunStats, dispatchWorkflow } from '@/lib/github';
import { enqueue, dequeue, getAllPending, countPending, remove } from './store';
import { QueueEntry } from './types';
import * as fs from 'fs';
import * as path from 'path';

const MAX_CHECKS = 5;

export async function processQueue(): Promise<{ queued: number; processed: number }> {
  const pending = getAllPending();
  if (pending.length === 0) return { queued: 0, processed: 0 };

  const { token, repo } = serverConfig();
  if (!token || !repo) return { queued: 0, processed: 0 };

  const octokit = octo(token);
  const ownerRepo = repo.split('/');
  const owner = ownerRepo[0];
  const repoName = ownerRepo[1];
  const workflowId = 'build.yml';

  let processed = 0;

  for (const entry of pending) {
    if (processed >= MAX_CHECKS) break;

    // Check if we have capacity
    try {
      const stats = await recentRunStats(octokit, owner, repoName, workflowId);
      if (stats.active >= 4 || stats.lastHour >= 40) {
        break; // No capacity, stop processing - leave entry pending
      }

      // Dispatch the build
      const inputs: Record<string, string> = {
        app_name: entry.appName,
        app_id: entry.appName.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'app',
        web_url: entry.url,
        site_zip: '',
        app_version: entry.appVersion || '0.1',
        app_build: entry.appBuild || '1',
        app_user_agent: entry.appUserAgent || '',
        app_icon: entry.appIcon || '',
        build_token: entry.buildToken || '',
      };

      // Handle ZIP vs URL mode
      if (entry.mode === 'zip' && entry.url) {
        inputs.site_zip = `builds/runs/site-${entry.buildToken || 'pending'}.zip`;
      }

      await dispatchWorkflow(octokit, owner, repoName, workflowId, 'main', inputs);

      // Mark as completed and remove from queue
      remove(entry.id);
      processed++;
    } catch (err) {
      console.error('Queue processor error:', err);
      // Remove failed entry from queue so it doesn't block
      try { remove(entry.id); } catch {}
      processed++;
    }
  }

  return { queued: pending.length, processed };
}