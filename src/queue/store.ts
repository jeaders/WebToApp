import { QueueEntry, QueueItem } from './types';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const QUEUE_DIR = path.join(process.cwd(), 'src', 'queue', 'entries');

if (!fs.existsSync(QUEUE_DIR)) {
  fs.mkdirSync(QUEUE_DIR, { recursive: true });
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
  const filePath = path.join(QUEUE_DIR, `${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(queueEntry, null, 2));
  return id;
}

export function dequeue(id: string): QueueEntry | null {
  const filePath = path.join(QUEUE_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  const entry: QueueEntry = JSON.parse(content);
  if (entry.status === 'pending') {
    fs.unlinkSync(filePath);
  }
  return entry.status === 'pending' ? entry : null;
}

export function getAllPending(): QueueEntry[] {
  const entries: QueueEntry[] = [];
  const files = fs.readdirSync(QUEUE_DIR).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(QUEUE_DIR, file), 'utf-8');
    const entry: QueueEntry = JSON.parse(content);
    if (entry.status === 'pending') {
      entries.push(entry);
    }
  }
  return entries;
}

export function getById(id: string): QueueEntry | null {
  const filePath = path.join(QUEUE_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

export function remove(id: string): boolean {
  const filePath = path.join(QUEUE_DIR, `${id}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

export function countPending(): number {
  return getAllPending().length;
}