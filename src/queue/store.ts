import { QueueEntry, QueueItem } from './types';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

// Su ambienti serverless (Netlify) il filesystem è read-only tranne /tmp.
// Usiamo /tmp per la coda così funziona anche su serverless.
const QUEUE_DIR = process.env.QUEUE_DIR || path.join('/tmp', 'webtoapp-queue');

function ensureDir(): boolean {
  try {
    if (!fs.existsSync(QUEUE_DIR)) {
      fs.mkdirSync(QUEUE_DIR, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}

export function enqueue(entry: Omit<QueueEntry, 'id' | 'createdAt' | 'status'>): string {
  const id = randomUUID();
  const createdAt = Date.now();
  const queueEntry: QueueEntry = {
    id,
    createdAt,
    status: 'pending',
    ...entry,
  };
  if (!ensureDir()) return id; // Se il filesystem è read-only, restituisci comunque l'ID
  try {
    const filePath = path.join(QUEUE_DIR, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(queueEntry, null, 2));
  } catch {
    // Filesystem non scrivibile: la coda non funziona ma non crasha
  }
  return id;
}

export function dequeue(id: string): QueueEntry | null {
  if (!ensureDir()) return null;
  const filePath = path.join(QUEUE_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const entry: QueueEntry = JSON.parse(content);
    if (entry.status === 'pending') {
      fs.unlinkSync(filePath);
    }
    return entry.status === 'pending' ? entry : null;
  } catch {
    return null;
  }
}

export function getAllPending(): QueueEntry[] {
  if (!ensureDir()) return [];
  const entries: QueueEntry[] = [];
  try {
    const files = fs.readdirSync(QUEUE_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(QUEUE_DIR, file), 'utf-8');
        const entry: QueueEntry = JSON.parse(content);
        if (entry.status === 'pending') {
          entries.push(entry);
        }
      } catch {
        // skip corrupted file
      }
    }
  } catch {
    return [];
  }
  return entries;
}

export function getById(id: string): QueueEntry | null {
  if (!ensureDir()) return null;
  const filePath = path.join(QUEUE_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function remove(id: string): boolean {
  if (!ensureDir()) return false;
  const filePath = path.join(QUEUE_DIR, `${id}.json`);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

export function countPending(): number {
  return getAllPending().length;
}