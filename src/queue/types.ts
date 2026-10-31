export interface QueueEntry {
  id: string;
  createdAt: number;
  repo: string;
  appName: string;
  url: string;
  branch: string;
  appVersion: string;
  appBuild: string;
  appUserAgent: string;
  appIcon: string;
  mode: 'zip' | 'url';
  buildToken?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export interface QueueItem {
  entry: QueueEntry;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}