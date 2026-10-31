"use client";

import React, { useState, useEffect } from 'react';
import {
  Upload,
  Settings,
  Smartphone,
  Download,
  Globe,
  Cpu,
  CheckCircle2,
  AlertCircle,
  LayoutDashboard,
  History,
  Zap,
  QrCode
} from 'lucide-react';
import { translations, Lang } from '@/lib/i18n';
import { InstallPwaButton } from '@/components/PwaRegister';

/* ------------------------------------------------------------------ */
/* Package ID                                                          */
/* ------------------------------------------------------------------ */
// Android identifica un'app dal package ID. Con un default fisso tutte le app
// generate avevano lo stesso ID: la seconda veniva installata come "aggiornamento"
// della prima (stesso ID + stessa firma) e sostituiva l'app già presente.
// Qui ne generiamo uno diverso per ogni sito, e blocchiamo i placeholder noti.
const PACKAGE_ID_RE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
const RESERVED_PACKAGE_IDS = [
  'com.yourname.app',
  'com.tuonome.app',
  'com.webtoapp.app',
  'com.webtoapp.starter',
  'com.example.app',
];

function packageSlug(value: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 30);
}

function derivePackageId(rawUrl: string, appName: string): string {
  let host = '';
  const value = (rawUrl || '').trim();
  if (value) {
    try {
      host = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname;
    } catch {
      host = '';
    }
  }
  let base = packageSlug(host) || packageSlug(appName) || 'app';
  if (/^[0-9]/.test(base)) base = `app${base}`;
  return `com.webtoapp.${base}`;
}

function packageIdProblem(id: string): 'empty' | 'format' | 'reserved' | null {
  const v = (id || '').trim();
  if (!v) return 'empty';
  if (RESERVED_PACKAGE_IDS.includes(v.toLowerCase())) return 'reserved';
  if (!PACKAGE_ID_RE.test(v)) return 'format';
  return null;
}

export default function Dashboard() {
  const [lang, setLang] = useState<Lang>('en');
  const t = (k: string): string => translations[lang][k] ?? k;

  // Lingua: default inglese, ricorda la scelta dell'utente
  useEffect(() => {
    try {
      const saved = localStorage.getItem('wta_lang');
      if (saved === 'en' || saved === 'it') setLang(saved);
    } catch { /* ignore */ }
  }, []);
  const changeLang = (l: Lang) => {
    setLang(l);
    try { localStorage.setItem('wta_lang', l); } catch { /* ignore */ }
  };

  const [activeTab, setActiveTab] = useState<'upload' | 'preview' | 'settings' | 'logs' | 'download'>('upload');
  const [previewScale, setPreviewScale] = useState(100);
  const [previewDevice, setPreviewDevice] = useState<'iphone' | 'android'>('iphone');
  const [viewportWidth, setViewportWidth] = useState(375);
  const [viewportHeight, setViewportHeight] = useState(667);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState(0);
  const [appName, setAppName] = useState('My Awesome App');
  const [appId, setAppId] = useState('');
  const [appIdTouched, setAppIdTouched] = useState(false);
  const [url, setUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#0070f3');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [appVersion, setAppVersion] = useState('0.1');
  const [appBuild, setAppBuild] = useState('1');
  const [appUserAgent, setAppUserAgent] = useState('WebToApp/0.1 (Android)');
  const [previewUrl, setPreviewUrl] = useState('');
  const [embeddable, setEmbeddable] = useState<boolean | null>(null);
  const [shotFailed, setShotFailed] = useState(false);
  const [zipPreviewUrl, setZipPreviewUrl] = useState<string | null>(null);
  const [zipPreviewNote, setZipPreviewNote] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showToast, setShowToast] = useState(false);
  const addLog = (message: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${time}] ${message}`]);
  };
  const [downloadLink, setDownloadLink] = useState<string | null>(null);
  const [githubToken, setGithubToken] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [serviceConfigured, setServiceConfigured] = useState<boolean | null>(null);
  const [appIcon, setAppIcon] = useState<string | null>(null);
  const [cloudBuildStatus, setCloudBuildStatus] = useState<'idle' | 'dispatching' | 'building' | 'success' | 'failed'>('idle');
  const [cloudRunId, setCloudRunId] = useState<number | null>(null);
  const [cloudRunUrl, setCloudRunUrl] = useState<string | null>(null);
  const [apkReady, setApkReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [winW, setWinW] = useState(1200);
  useEffect(() => {
    const on = () => setWinW(typeof window !== 'undefined' ? window.innerWidth : 1200);
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const go = (tab: 'upload' | 'preview' | 'settings' | 'logs' | 'download') => {
    setActiveTab(tab);
    setMenuOpen(false);
  };

  // Anteprima: debounce per non bombardare il proxy mentre l'utente scrive.
  useEffect(() => {
    const v = url.trim();
    if (!v) {
      setPreviewUrl('');
      return;
    }
    const abs = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    const id = setTimeout(() => setPreviewUrl(abs), 700);
    return () => clearTimeout(id);
  }, [url]);

  // Package ID: generato dal sito (o dal nome del file / dell'app) finché
  // l'utente non lo modifica a mano. Ogni app ottiene così un ID diverso.
  useEffect(() => {
    if (appIdTouched) return;
    const fallbackName = selectedFile ? selectedFile.name.replace(/\.zip$/i, '') : appName;
    setAppId(derivePackageId(url, fallbackName));
  }, [url, appName, selectedFile, appIdTouched]);

  // Shortcut PWA: /?tab=preview ecc.
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab === 'upload' || tab === 'preview' || tab === 'settings' || tab === 'logs' || tab === 'download') {
      setActiveTab(tab);
    }
  }, []);

  // I siti con X-Frame-Options / CSP frame-ancestors non si possono incorniciare:
  // in quel caso mostriamo un'anteprima statica (screenshot) con link al sito.
  useEffect(() => {
    if (!previewUrl) {
      setEmbeddable(null);
      return;
    }
    let alive = true;
    setEmbeddable(null);
    fetch(`/api/embed-check?url=${encodeURIComponent(previewUrl)}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) setEmbeddable(Boolean(d?.embeddable));
      })
      .catch(() => {
        if (alive) setEmbeddable(false);
      });
    return () => {
      alive = false;
    };
  }, [previewUrl]);

  // Anteprima reale dell'archivio ZIP: apriamo il pacchetto con JSZip, individuiamo
  // l'HTML d'ingresso e riscriviamo i riferimenti agli asset come blob URL, così il
  // telefono mostra il sito anche per gli upload (senza aspettare la build).
  useEffect(() => {
    let alive = true;
    const blobs: string[] = [];
    const revoke = () => {
      while (blobs.length) {
        try { URL.revokeObjectURL(blobs.pop() as string); } catch { /* ignora */ }
      }
    };
    if (!selectedFile) {
      revoke();
      setZipPreviewUrl(null);
      setZipPreviewNote(null);
      return () => { alive = false; };
    }
    (async () => {
      try {
        const JSZip = (await import('jszip')).default;
        type Entry = { name: string; dir: boolean; async: (kind: 'string' | 'arraybuffer') => Promise<any> };
        const zip = await JSZip.loadAsync(selectedFile);
        const files = (Object.values(zip.files) as Entry[]).filter(
          (f) => !f.dir && !f.name.startsWith('__MACOSX/') && !(f.name.split('/').pop()?.startsWith('.') ?? false)
        );
        const byDepth = (a: Entry, b: Entry) =>
          a.name.split('/').length - b.name.split('/').length || a.name.localeCompare(b.name);
        const htmls = files.filter((f) => /\.html?$/i.test(f.name)).sort(byDepth);
        const entry = htmls.find((f) => /(^|\/)index\.html?$/i.test(f.name)) || (htmls.length === 1 ? htmls[0] : null);
        if (!entry) {
          if (alive) {
            setZipPreviewUrl(null);
            setZipPreviewNote(t('src.zipNoEntry'));
          }
          return;
        }
        let html = await entry.async('string');
        let note = '';

        // Riscrivo i riferimenti locali (src/href/url()) come blob URL. L'anteprima è
        // approssimativa per i file esterni particolari: nell'app l'intero archivio
        // viene incluso e lì funziona tutto, anche gli asset multi-livello.
        const MIME: Record<string, string> = {
          png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
          svg: 'image/svg+xml', webp: 'image/webp', ico: 'image/x-icon',
          css: 'text/css', js: 'text/javascript', mjs: 'text/javascript',
          json: 'application/json', woff: 'font/woff', woff2: 'font/woff2',
          ttf: 'font/ttf', otf: 'font/otf', mp4: 'video/mp4', webm: 'video/webm',
        };
        const map = new Map<string, string>();
        if (files.length <= 80) {
          for (const f of files) {
            if (f === entry || /\.html?$/i.test(f.name)) continue;
            const ext = f.name.split('/').pop()?.split('.').pop()?.toLowerCase() ?? '';
            const mime = MIME[ext];
            if (!mime) continue;
            try {
              const u = URL.createObjectURL(new Blob([await f.async('arraybuffer')], { type: mime }));
              blobs.push(u);
              const base = f.name.split('/').pop() as string;
              if (!map.has(base)) map.set(base, u);
            } catch { /* asset ignorato */ }
          }
        }
        const rewrite = (val: string): string | null => {
          const path = val.split(/([?#])/)[0];
          if (!path || /^[a-zA-Z][\w+.-]*:/.test(path) || path.startsWith('//') || path.startsWith('#') || !path.includes('.')) return null;
          const candidates = [path, path.replace(/^\.\//, ''), path.replace(/^\.\.\//, ''), path.split('/').pop() ?? ''];
          for (const c of candidates) {
            if (c && map.has(c)) return (map.get(c) as string) + val.slice(path.length);
          }
          return null;
        };
        if (map.size) {
          html = html.replace(/(["'])([^"']*)\1/g, (match: string, quote: string, val: string) => {
            const next = rewrite(val);
            return next === null ? match : quote + next + quote;
          });
          html = html.replace(/url\(\s*(['"]?)([^'")]+?)['"]?\s*\)/gi, (match: string, quote2: string, val: string) => {
            const next = rewrite(val);
            return next === null ? match : `url(${quote2}${next}${quote2})`;
          });
        }
        if (map.size) {
          note = t('src.zipPreviewNote') as string;
        }

        const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
        blobs.push(url);
        if (!alive) return;
        setZipPreviewUrl(url);
        setZipPreviewNote(note || null);
      } catch {
        if (!alive) return;
        setZipPreviewUrl(null);
        setZipPreviewNote(t('src.zipNoEntry') as string);
      }
    })();
    return () => {
      alive = false;
      setTimeout(revoke, 1000);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile]);

  const screenshotSrc = previewUrl
    ? `https://image.thum.io/get/width/600/crop/1100/noanimate/${previewUrl}`
    : '';

  // Se lo screenshot non si carica mostriamo un fallback con link al sito.
  useEffect(() => {
    setShotFailed(false);
  }, [screenshotSrc]);

  // La build cloud è preconfigurata dal gestore del sito? (token lato server)
  useEffect(() => {
    let alive = true;
    fetch('/api/config')
      .then((r) => r.json())
      .then((d) => { if (alive) setServiceConfigured(Boolean(d?.configured)); })
      .catch(() => { if (alive) setServiceConfigured(false); });
    return () => { alive = false; };
  }, []);

  const needsManualAuth = serviceConfigured === false;

  const downloadApk = async () => {
    if (!cloudRunId) return;
    addLog(t('log.downloadApk'));
    const auth = needsManualAuth ? { token: githubToken, repo: githubRepo } : {};
    try {
      const res = await fetch('/api/cloud-artifact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...auth, runId: cloudRunId, lang }),
      });
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const data = await res.json();
        throw new Error(data.error || t('log.downloadErr'));
      }
      if (!res.ok) throw new Error(t('log.downloadErr'));
      const blob = await res.blob();
      const urlB = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = urlB;
      a.download = `${appName.replace(/\s+/g, '-') || 'app'}-${appId}.apk`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(urlB);
      addLog(t('log.apkDownloaded'));
    } catch (error: any) {
      addLog(`${t('log.apkDlErr')}${error.message}`);
    }
  };

  const triggerCloudBuild = async () => {
    if (needsManualAuth && (!githubToken || !githubRepo)) {
      alert(t('log.configure'));
      setActiveTab('settings');
      return;
    }
    if (!url && !selectedFile) {
      alert(t('log.needInput'));
      setActiveTab('upload');
      return;
    }

    // Package ID: senza un ID valido l'app sovrascriverebbe quella già installata.
    const effectiveAppId =
      appId.trim() ||
      derivePackageId(url, selectedFile ? selectedFile.name.replace(/\.zip$/i, '') : appName);
    const idProblem = packageIdProblem(effectiveAppId);
    if (idProblem) {
      const message = t(`set.packageIdError.${idProblem}`);
      addLog(message);
      alert(message);
      setActiveTab('settings');
      return;
    }
    if (!appId.trim()) setAppId(effectiveAppId);

    // Validazione file ZIP se presente
    if (selectedFile) {
      if (!selectedFile.size || selectedFile.size === 0) {
        alert(t('log.needValidZip'));
        setActiveTab('upload');
        return;
      }
      if (!selectedFile.name.toLowerCase().endsWith('.zip')) {
        alert(t('log.needZipFile'));
        setActiveTab('upload');
        return;
      }
    }

    setCloudBuildStatus('dispatching');
    setApkReady(false);
    setCloudRunId(null);
    setCloudRunUrl(null);
    setQrDataUrl(null);
    setQrOpen(false);
    addLog(selectedFile ? t('log.startZip') : t('log.startUrl'));
    addLog(`Package ID: ${effectiveAppId}`);

    const auth = needsManualAuth ? { token: githubToken, repo: githubRepo } : {};
    const startedMs = Date.now() - 5000; // tolleranza: ignora run create prima del click

    try {
      const fd = new FormData();
      fd.append('appName', appName);
      fd.append('appId', effectiveAppId);
      const cleanUrl = url && !/^https?:\/\//i.test(url) ? 'https://' + url : (url || '');
      fd.append('url', cleanUrl);
      fd.append('branch', 'main');
      fd.append('lang', lang);
      fd.append('appVersion', appVersion);
      fd.append('appBuild', appBuild);
      fd.append('appUserAgent', appUserAgent);
      if (auth.token) fd.append('token', auth.token);
      if (auth.repo) fd.append('repo', auth.repo);
      if (selectedFile) fd.append('file', selectedFile);
      // Icona scelta o generata: senza questo campo le build usano l'icona di default
      if (appIcon) fd.append('appIcon', appIcon);

      const response = await fetch('/api/github-build', {
        method: 'POST',
        body: fd,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t('log.sendErr'));

      const branch = data.branch || 'main';
      const headSha = data.headSha || '';
      addLog(t('log.started'));
      setCloudBuildStatus('building');

      const latest = async () => {
        const r = await fetch('/api/cloud-latest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...auth, branch, headSha, lang }),
        });
        return r.json().catch(() => ({}));
      };

      let finished = false;
      for (let i = 0; i < 70 && !finished; i++) {
        await new Promise((r) => setTimeout(r, 8000));
        const l = await latest();
        if (!l.runId) continue;
        // Con la run fissata al commit, l'abbinamento avviene tramite headSha e l'ora di inizio: riusciamo a tracciare solo la nostra build anche nel caso in cui altri utenti abbiano avviato build contemporaneamente.
        if (headSha && l.headSha && l.headSha !== headSha) continue;
        if (l.createdAt && Date.parse(l.createdAt) < startedMs) continue; // run precedente
        setCloudRunId(l.runId);
        if (l.htmlUrl) setCloudRunUrl(l.htmlUrl);
        if (l.status === 'completed') {
          finished = true;
          if (l.conclusion === 'success') {
            setCloudBuildStatus('success');
            setApkReady(true);
            addLog(t('log.done'));
            setActiveTab('download');
          } else {
            setCloudBuildStatus('failed');
            addLog(`${t('log.ended')}${l.conclusion || ''}`);
          }
        } else {
          addLog(`⏳ ${t('log.run')}${l.runNumber}: ${l.status}...`);
        }
      }
      if (!finished && cloudBuildStatus === 'building') {
        addLog(t('log.waiting'));
      }
    } catch (error: any) {
      addLog(`${t('log.cloudErr')}${error.message}`);
      setCloudBuildStatus('failed');
    }
  };

  const handleIconFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert("Per favore carica un'immagine valida.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAppIcon(reader.result as string);
    reader.readAsDataURL(file);
  };

  const generateRandomIcon = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const hue = Math.floor(Math.random() * 360);
    ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(256, 256, 110, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 180px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((appName.charAt(0) || 'W').toUpperCase(), 256, 260);
    setAppIcon(canvas.toDataURL('image/png'));
  };

  const showQrCode = async () => {
    if (!cloudRunId) return;
    try {
      const QRCode = (await import('qrcode')).default;
      const link = `${window.location.origin}/api/cloud-artifact?runId=${cloudRunId}`;
      const dataUrl = await QRCode.toDataURL(link, {
        width: 640,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#111111', light: '#ffffff' },
      });
      setQrDataUrl(dataUrl);
      setQrOpen(true);
    } catch (error: any) {
      addLog(`${t('dl.qrError')} ${error?.message || ''}`.trim());
    }
  };

  const downloadQrCode = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `webtoapp-qr-${cloudRunId || 'apk'}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const startBuild = async () => {
    if (!url && !selectedFile) {
      alert(t('log.needInput'));
      return;
    }

    const effectiveAppId =
      appId.trim() ||
      derivePackageId(url, selectedFile ? selectedFile.name.replace(/\.zip$/i, '') : appName);
    const idProblem = packageIdProblem(effectiveAppId);
    if (idProblem) {
      const message = t(`set.packageIdError.${idProblem}`);
      addLog(message);
      alert(message);
      setActiveTab('settings');
      return;
    }
    if (!appId.trim()) setAppId(effectiveAppId);

    setIsBuilding(true);
    setBuildProgress(0);
    setLogs([]);
    setDownloadLink(null);
    setActiveTab('logs');
    addLog(t('log.init'));

    try {
      const formData = new FormData();
      formData.append('appName', appName);
      formData.append('appId', effectiveAppId);
      formData.append('url', url);
      formData.append('primaryColor', primaryColor);
      formData.append('lang', lang);
      if (selectedFile) formData.append('file', selectedFile);
      if (appIcon) formData.append('appIcon', appIcon);

      addLog(t('log.sending2'));

      const response = await fetch('/api/build', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('log.error'));

      addLog(t('log.capDone'));
      addLog(t('log.genSrc'));

      let progress = 20;
      const interval = setInterval(() => {
        progress += 10;
        setBuildProgress(Math.min(progress, 90));
        if (progress === 40) addLog(t('log.optWeb'));
        if (progress === 60) addLog(t('log.manifest'));
        if (progress === 80) addLog(t('log.packaging'));
      }, 500);

      setTimeout(() => {
        clearInterval(interval);
        setBuildProgress(100);
        setDownloadLink(data.downloadUrl);
        addLog(t('log.projectOk'));
        addLog(`${t('log.dlLink')}${data.downloadUrl}`);
        setIsBuilding(false);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000);
      }, 4000);

    } catch (error: any) {
      addLog(`${t('log.error')}${error.message}`);
      setIsBuilding(false);
    }
  };

  const LangToggle = () => (
    <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
      <button
        onClick={() => changeLang('en')}
        className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${lang === 'en' ? 'bg-black text-white' : 'text-gray-500 hover:text-gray-900'}`}
      >EN</button>
      <button
        onClick={() => changeLang('it')}
        className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${lang === 'it' ? 'bg-black text-white' : 'text-gray-500 hover:text-gray-900'}`}
      >IT</button>
    </div>
  );

  // Anteprima del sito: iframe interattivo se consentito, altrimenti screenshot.
  const renderSite = (className: string) => {
    if (!previewUrl) return null;

    if (embeddable === null) {
      return (
        <div className={`${className} flex items-center justify-center bg-gray-50`}>
          <span className="text-xs text-gray-400 animate-pulse">{t('preview.loading')}</span>
        </div>
      );
    }

    if (embeddable) {
      return <iframe src={previewUrl} className={className} title="Preview" />;
    }

    if (shotFailed) {
      return (
        <div className={`${className} flex flex-col items-center justify-center gap-2 bg-gray-50 p-3 text-center`}>
          <span className="text-xs text-gray-400">{t('preview.staticNote')}</span>
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-bold text-primary hover:underline"
          >
            {t('preview.openNew')}
          </a>
        </div>
      );
    }

    return (
      <img
        src={screenshotSrc}
        alt="Anteprima del sito"
        onError={() => setShotFailed(true)}
        className={`${className} object-cover object-top bg-gray-50`}
      />
    );
  };

  const frameW = previewDevice === 'iphone' ? viewportWidth + 24 : viewportWidth + 16;
  const frameH = previewDevice === 'iphone' ? viewportHeight + 60 : viewportHeight + 20;
  // Su schermi stretti il device frame viene ridotto per non creare scroll orizzontale
  const fit = winW < 768 ? Math.min(1, (winW - 48) / frameW) : 1;
  const totalScale = (previewScale / 100) * fit;

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col md:flex-row overflow-x-hidden">
      {/* Mobile top bar + quick tab strip */}
      <div className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="flex items-center justify-between px-3 py-2">
          <button onClick={() => setMenuOpen(true)} aria-label="Open menu" className="p-2 rounded-lg hover:bg-gray-100">
            <LayoutDashboard size={22} className="text-gray-700" />
          </button>
          <span className="font-bold text-lg tracking-tight flex items-center gap-2">
            <span className="bg-primary p-1.5 rounded-lg"><Smartphone className="w-4 h-4 text-white" /></span>
            WebToApp
          </span>
          <LangToggle />
        </div>
        <div className="flex gap-1.5 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
          {[
            { id: 'upload', icon: <LayoutDashboard size={15} />, label: t('nav.dashboard') },
            { id: 'preview', icon: <Smartphone size={15} />, label: t('nav.preview') },
            { id: 'settings', icon: <Settings size={15} />, label: t('nav.settings') },
            { id: 'logs', icon: <History size={15} />, label: t('nav.logs') },
            { id: 'download', icon: <Download size={15} />, label: t('nav.download') },
          ].map((tb) => (
            <button
              key={tb.id}
              onClick={() => go(tb.id as any)}
              className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-2 rounded-full text-xs font-bold transition-all ${
                activeTab === tb.id ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {tb.icon}{tb.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sidebar backdrop (mobile) */}
      {menuOpen && <div className="md:hidden fixed inset-0 bg-black/40 z-30" onClick={() => setMenuOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed md:sticky top-0 left-0 z-40 h-screen w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-200 ${menuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="p-6 border-b border-gray-100 flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg">
            <Smartphone className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">WebToApp</span>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem
            icon={<LayoutDashboard size={20} />}
            label={t('nav.dashboard')}
            active={activeTab === 'upload'}
            onClick={() => go('upload')}
          />
          <SidebarItem
            icon={<Smartphone size={20} />}
            label={t('nav.preview')}
            active={activeTab === 'preview'}
            onClick={() => go('preview')}
          />
          <SidebarItem
            icon={<Settings size={20} />}
            label={t('nav.settings')}
            active={activeTab === 'settings'}
            onClick={() => go('settings')}
          />
          <SidebarItem
            icon={<History size={20} />}
            label={t('nav.logs')}
            active={activeTab === 'logs'}
            onClick={() => go('logs')}
          />
          <SidebarItem
            icon={<Download size={20} />}
            label={t('nav.download')}
            active={activeTab === 'download'}
            onClick={() => go('download')}
          />
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="bg-blue-50 p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={16} className="text-blue-600" />
              <span className="text-sm font-semibold text-blue-900">{t('plan.mvp')}</span>
            </div>
            <p className="text-xs text-blue-700">{t('plan.text')}</p>
          </div>
        </div>

        <div className="px-4 pb-4 text-[11px] text-gray-400 text-center leading-relaxed">
          {t('copyright')}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 md:sticky md:top-0 z-10 p-4 md:p-6">
          <div className="flex flex-wrap gap-3 justify-between items-center max-w-5xl mx-auto">
            <h1 className="text-xl md:text-2xl font-semibold text-gray-900">
              {activeTab === 'upload' && t('title.upload')}
              {activeTab === 'preview' && t('title.preview')}
              {activeTab === 'settings' && t('title.settings')}
              {activeTab === 'logs' && t('title.logs')}
              {activeTab === 'download' && t('title.download')}
            </h1>
            <div className="flex gap-3 items-center">
              <div className="hidden md:flex"><LangToggle /></div>
              <button
                onClick={triggerCloudBuild}
                disabled={cloudBuildStatus === 'dispatching' || cloudBuildStatus === 'building'}
                className="bg-black text-white px-4 py-2 rounded-full font-medium hover:bg-gray-800 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {cloudBuildStatus === 'dispatching'
                  ? t('btn.sending')
                  : cloudBuildStatus === 'building'
                    ? t('btn.cloudBuilding')
                    : t('btn.start')}
                {cloudBuildStatus !== 'dispatching' && cloudBuildStatus !== 'building' && <Cpu size={18} />}
              </button>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8 pb-24 md:pb-10 max-w-5xl mx-auto space-y-6 md:space-y-8">
          {activeTab === 'upload' && (
            <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe size={16} className="text-purple-500" />
                    <span className="text-sm font-bold">{t('feat.cloud.title')}</span>
                  </div>
                  <p className="text-xs text-gray-500">{t('feat.cloud.text')}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={16} className="text-amber-500" />
                    <span className="text-sm font-bold">{t('feat.ssl.title')}</span>
                  </div>
                  <p className="text-xs text-gray-500">{t('feat.ssl.text')}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap size={16} className="text-blue-500" />
                    <span className="text-sm font-bold">{t('feat.opt.title')}</span>
                  </div>
                  <p className="text-xs text-gray-500">{t('feat.opt.text')}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {/* Upload Section */}
                <div className="bg-white p-5 md:p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="mb-6">
                    <h3 className="text-lg font-bold mb-2">{t('src.title')}</h3>
                    <p className="text-sm text-gray-500">{t('src.subtitle')}</p>
                  </div>

                  <div className="space-y-4">
                    <div className="relative">
                      <Globe className="absolute left-3 top-3 text-gray-400" size={18} />
                      <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder={t('src.urlPlaceholder')}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                      />
                    </div>

                    <div className="flex items-center justify-center w-full">
                      <label className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${selectedFile ? 'border-primary bg-blue-50' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}>
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Upload className={`w-8 h-8 mb-4 ${selectedFile ? 'text-primary' : 'text-gray-400'}`} />
                          <p className="mb-2 text-sm text-gray-500 font-medium">
                            {selectedFile ? selectedFile.name : t('src.drop')}
                          </p>
                          <p className="text-xs text-gray-400">{t('src.dropHint')}</p>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept=".zip"
                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Preview Card */}
                <div className="bg-white p-5 md:p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center">
                  <div className="relative w-48 h-96 bg-gray-900 rounded-[3rem] border-8 border-gray-800 shadow-2xl overflow-hidden">
                    <div className="absolute top-0 w-full h-6 bg-gray-800 flex justify-center z-20">
                      <div className="w-20 h-4 bg-black rounded-b-xl"></div>
                    </div>
                    <div className="w-full h-full bg-white flex items-center justify-center overflow-hidden">
                      {previewUrl ? (
                        renderSite('w-full h-full border-none scale-[0.9] origin-top')
                      ) : selectedFile ? (
                        zipPreviewUrl ? (
                          <iframe
                            src={zipPreviewUrl}
                            title={t('src.zipReady') as string}
                            className="w-full h-full border-none"
                            sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
                          />
                        ) : (
                          <div className="text-center p-4">
                            <Upload className="mx-auto mb-2 text-blue-200" size={40} />
                            <p className="text-xs text-blue-400 font-medium">
                              {t('src.zipReady')} {selectedFile.name}
                            </p>
                            <p className="text-xs text-gray-400">{zipPreviewNote ?? t('src.zipBuildHint')}</p>
                          </div>
                        )
                      ) : (
                        <div className="text-center p-4">
                          <Globe className="mx-auto mb-2 text-blue-200" size={40} />
                          <p className="text-xs text-blue-400 font-medium">{t('src.previewEmpty')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="mt-6 text-sm text-gray-500">{t('src.simulator')}</p>
                </div>
              </div>

              {isBuilding && (
                <div className="bg-white p-4 md:p-6 rounded-2xl border border-blue-100 animate-pulse">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-semibold text-blue-900">{t('src.generating')}</span>
                    <span className="text-sm font-medium text-blue-600">{buildProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-300"
                      style={{ width: `${buildProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </section>
          )}

          {activeTab === 'preview' && (
            <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-500 pb-20">
              <div className="sticky top-2 md:top-4 z-50 w-full max-w-2xl space-y-3 md:space-y-4 mb-8 md:mb-12">
                <div className="flex items-center justify-between bg-white/80 backdrop-blur-md p-3 rounded-2xl border border-gray-100 shadow-lg">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setPreviewDevice('iphone'); setViewportWidth(375); setViewportHeight(667); }}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${previewDevice === 'iphone' ? 'bg-black text-white' : 'hover:bg-gray-50'}`}
                    >
                      {t('preview.iphone')}
                    </button>
                    <button
                      onClick={() => { setPreviewDevice('android'); setViewportWidth(360); setViewportHeight(740); }}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${previewDevice === 'android' ? 'bg-black text-white' : 'hover:bg-gray-50'}`}
                    >
                      {t('preview.android')}
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-gray-400 uppercase">{t('preview.zoom')}</span>
                      <input
                        type="range"
                        min="30"
                        max="100"
                        value={previewScale}
                        onChange={(e) => setPreviewScale(parseInt(e.target.value))}
                        className="w-24 accent-black"
                      />
                      <span className="text-xs font-mono text-gray-500 w-8">{previewScale}%</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-gray-100 shadow-lg grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('preview.width')}</label>
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">{viewportWidth}px</span>
                    </div>
                    <input
                      type="range"
                      min="320"
                      max="1024"
                      value={viewportWidth}
                      onChange={(e) => setViewportWidth(parseInt(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('preview.height')}</label>
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">{viewportHeight}px</span>
                    </div>
                    <input
                      type="range"
                      min="480"
                      max="1366"
                      value={viewportHeight}
                      onChange={(e) => setViewportHeight(parseInt(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>
                </div>

                <div className="text-center space-y-1">
                  <p className="text-[10px] text-gray-400 font-medium">
                    💡 <b>Info:</b> {t('preview.info')}
                  </p>
                  {embeddable === false && (
                    <p className="text-[10px] text-amber-600 font-medium">{t('preview.staticNote')}</p>
                  )}
                  {previewUrl && (
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-xs text-primary font-bold hover:underline"
                    >
                      {t('preview.openNew')}
                    </a>
                  )}
                </div>
              </div>

              {/* Device Frame (auto-scaled to fit the viewport) */}
              <div
                className="relative mx-auto"
                style={{ width: frameW * totalScale, height: (frameH + 30) * totalScale }}
              >
                <div
                  className="relative transition-all duration-500 origin-top-left"
                  style={{ transform: `scale(${totalScale})` }}
                >
                {previewDevice === 'iphone' ? (
                  <div
                    style={{ width: viewportWidth + 24, height: viewportHeight + 60 }}
                    className="bg-black rounded-[55px] p-3 shadow-2xl border-[6px] border-[#1f1f1f] relative overflow-hidden transition-all duration-300"
                  >
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-20" />

                    <div className="w-full h-full bg-white rounded-[42px] overflow-hidden relative">
                      {previewUrl ? (
                        renderSite('w-full h-full border-none')
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                          <div className="w-16 h-16 bg-gray-100 rounded-2xl mb-4 flex items-center justify-center">
                            <Globe size={32} className="text-gray-300" />
                          </div>
                          <p className="text-gray-400 text-sm font-medium">{t('src.previewEmpty')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    style={{ width: viewportWidth + 16, height: viewportHeight + 20 }}
                    className="bg-black rounded-[40px] p-2 shadow-2xl border-[4px] border-[#2a2a2a] relative overflow-hidden transition-all duration-300"
                  >
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#1a1a1a] rounded-full z-20" />

                    <div className="w-full h-full bg-white rounded-[32px] overflow-hidden relative">
                      {previewUrl ? (
                        renderSite('w-full h-full border-none')
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                          <div className="w-16 h-16 bg-gray-100 rounded-2xl mb-4 flex items-center justify-center">
                            <Globe size={32} className="text-gray-300" />
                          </div>
                          <p className="text-gray-400 text-sm font-medium">{t('src.previewEmpty')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-[80%] h-4 bg-black/10 blur-xl rounded-full" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <section className="bg-white p-5 md:p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-gray-700">{t('set.appName')}</label>
                  <input
                    type="text"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    placeholder={t('set.appNamePlaceholder')}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                  />
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <label className="block text-sm font-bold text-gray-700">{t('set.packageId')}</label>
                    <button
                      type="button"
                      onClick={() => {
                        setAppIdTouched(false);
                        setAppId(derivePackageId(url, selectedFile ? selectedFile.name.replace(/\.zip$/i, '') : appName));
                      }}
                      className="text-xs text-primary font-medium hover:underline"
                    >
                      {t('set.packageIdAuto')}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={appId}
                    onChange={(e) => { setAppId(e.target.value); setAppIdTouched(true); }}
                    placeholder={t('set.packageIdPlaceholder')}
                    className={`w-full p-3 bg-gray-50 border rounded-xl font-mono text-sm ${
                      appIdTouched && packageIdProblem(appId) ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`}
                  />
                  {appIdTouched && packageIdProblem(appId) ? (
                    <p className="text-xs text-red-500 font-medium">
                      {t(`set.packageIdError.${packageIdProblem(appId)}`)}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400">{t('set.packageIdHint')}</p>
                  )}
                </div>
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-gray-700">{t('set.version')}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={appVersion}
                    onChange={(e) => setAppVersion(e.target.value)}
                    placeholder={t('set.versionHint')}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                  />
                  <p className="text-xs text-gray-400">{t('set.versionHint')}</p>
                </div>
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-gray-700">{t('set.build')}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={appBuild}
                    onChange={(e) => setAppBuild(e.target.value)}
                    placeholder="1"
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                  />
                  <p className="text-xs text-gray-400">{t('set.buildHint')}</p>
                </div>
                <div className="space-y-4 md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700">{t('set.userAgent')}</label>
                  <input
                    type="text"
                    value={appUserAgent}
                    onChange={(e) => setAppUserAgent(e.target.value)}
                    placeholder="WebToApp/0.1 (Android)"
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm"
                  />
                  <p className="text-xs text-gray-400">{t('set.userAgentHint')}</p>
                </div>
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-gray-700">{t('set.primaryColor')}</label>
                  <div className="flex gap-3">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-12 h-12 rounded-lg cursor-pointer border-none"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      placeholder="#0070f3"
                      className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-gray-700">{t('set.icon')}</label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden relative">
                      {appIcon ? (
                        <img src={appIcon} alt="Icona" className="w-full h-full object-cover" />
                      ) : (
                        <Upload size={20} className="text-gray-400" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 cursor-pointer text-sm text-primary hover:underline">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleIconFileChange}
                        />
                        {t('set.uploadIcon')}
                      </label>
                      <button
                        onClick={generateRandomIcon}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Zap size={14} /> {t('set.generateIcon')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-gray-100">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Globe size={20} className="text-purple-500" />
                  {t('dl.cloudTitle')}
                </h3>
                <div className="bg-purple-50/50 p-6 rounded-2xl border border-purple-100 space-y-4">
                  {serviceConfigured === true && (
                    <p className="text-sm text-purple-800">
                      {t('cloud.configured')}
                    </p>
                  )}
                  {serviceConfigured === false && (
                    <>
                      <p className="text-sm text-purple-800">
                        {t('cloud.notConfigured')}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-purple-700">{t('cloud.tokenLabel')}</label>
                          <input
                            type="password"
                            value={githubToken}
                            onChange={(e) => setGithubToken(e.target.value)}
                            placeholder="ghp_xxxxxxxxxxxx"
                            className="w-full p-3 bg-white border border-purple-200 rounded-xl text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-purple-700">{t('cloud.repoLabel')}</label>
                          <input
                            type="text"
                            value={githubRepo}
                            onChange={(e) => setGithubRepo(e.target.value)}
                            placeholder="your-user/your-repo"
                            className="w-full p-3 bg-white border border-purple-200 rounded-xl text-sm"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* PWA */}
              <div className="pt-8 border-t border-gray-100">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Smartphone size={20} className="text-green-600" />
                  {t('set.pwaTitle')}
                </h3>
                <div className="bg-green-50/50 p-6 rounded-2xl border border-green-100 flex flex-col md:flex-row md:items-center gap-4 md:justify-between">
                  <p className="text-sm text-green-800 max-w-xl">{t('set.pwaText')}</p>
                  <InstallPwaButton label={t('set.install')} />
                </div>
              </div>

              {/* Deep Linking */}
              <div className="pt-8 border-t border-gray-100">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Zap size={20} className="text-blue-500" />
                  {t('set.deepLinking')}
                </h3>
                <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                  <p className="text-sm text-blue-800 mb-4">
                    {t('set.deepLinkingText')}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" placeholder={t('set.deepLink1')} className="p-3 bg-white border border-blue-200 rounded-xl text-sm" />
                    <input type="text" placeholder={t('set.deepLink2')} className="p-3 bg-white border border-blue-200 rounded-xl text-sm" />
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'logs' && (
            <div className="bg-black rounded-2xl p-4 md:p-6 font-mono text-xs text-green-400 min-h-[400px] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-300">
              <div className="flex gap-2 mb-4 border-b border-gray-800 pb-2 text-gray-500">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                <span className="ml-2 font-sans">{t('logs.terminal')}</span>
              </div>
              <div className="space-y-1">
                {logs.length > 0 ? logs.map((log, i) => (
                  <p key={i}>{log}</p>
                )) : (
                  <p className="text-gray-600 italic">{t('logs.empty')}</p>
                )}
                {isBuilding && <p className="animate-pulse">_</p>}
              </div>
            </div>
          )}

          {activeTab === 'download' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Cloud build (always available) — the path that produces the APK */}
              <div className="bg-white p-5 md:p-8 rounded-3xl border border-blue-100 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                      <Cpu size={20} className="text-primary shrink-0" /> {t('dl.cloudTitle')}
                    </h3>
                    <p className="text-sm text-gray-500 max-w-xl">
                      {t('dl.cloudDesc')}{' '}
                      <button onClick={() => go('settings')} className="text-primary font-medium hover:underline">{t('settingsLink')}</button>
                    </p>
                  </div>
                  <button
                    onClick={triggerCloudBuild}
                    disabled={cloudBuildStatus === 'dispatching' || cloudBuildStatus === 'building'}
                    className="shrink-0 flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50 w-full lg:w-auto"
                  >
                    <Cpu size={20} />
                    {cloudBuildStatus === 'dispatching' ? t('btn.sending') : cloudBuildStatus === 'building' ? t('btn.cloudBuilding') : t('btn.generate')}
                  </button>
                </div>

                {(cloudBuildStatus !== 'idle') && (
                  <div className="mt-4 p-4 rounded-xl bg-gray-50 border border-gray-100 text-sm">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <span className="font-semibold text-gray-700">
                        {cloudBuildStatus === 'dispatching' && t('dl.status.dispatching')}
                        {cloudBuildStatus === 'building' && t('dl.status.building')}
                        {cloudBuildStatus === 'success' && t('dl.status.success')}
                        {cloudBuildStatus === 'failed' && t('dl.status.failed')}
                      </span>
                      {cloudRunUrl && (
                        <a href={cloudRunUrl} target="_blank" rel="noreferrer" className="text-primary font-medium hover:underline">
                          {t('openRun')}
                        </a>
                      )}
                      {apkReady && (
                        <>
                          <button onClick={downloadApk} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 transition-all">
                            <Download size={16} /> {t('btn.downloadApk')}
                          </button>
                          <button onClick={showQrCode} className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg font-bold hover:bg-black transition-all">
                            <QrCode size={16} /> {t('btn.qr')}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Local source (dev/filesystem only) */}
              {downloadLink ? (
                <div className="bg-white p-5 md:p-6 rounded-3xl border border-green-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold">{t('dl.localTitle')}</h3>
                    <p className="text-sm text-gray-500">{t('dl.localDesc')}</p>
                  </div>
                  <a
                    href={downloadLink}
                    download
                    className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all"
                  >
                    <Download size={20} /> {t('btn.downloadZip')}
                  </a>
                </div>
              ) : (
                <div className="bg-white p-5 md:p-6 rounded-3xl border border-gray-100 shadow-sm text-sm text-gray-500">
                  {t('dl.localDisabled')}
                </div>
              )}

              <div className="bg-white p-5 md:p-6 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-green-50 text-green-600">
                    <Smartphone size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{t('dl.androidTitle')}</h4>
                    <p className="text-xs text-gray-500">{t('dl.androidDesc')}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* QR Code modal */}
      {qrOpen && qrDataUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setQrOpen(false)}
        >
          <div
            className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold">{t('dl.qrTitle')}</h3>
            <img
              src={qrDataUrl}
              alt="QR code"
              className="w-full max-w-[280px] mx-auto rounded-2xl border border-gray-100"
            />
            <p className="text-xs text-gray-500">{t('dl.qrDesc')}</p>
            <div className="flex gap-2">
              <button
                onClick={downloadQrCode}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl font-bold hover:bg-blue-600 transition-all"
              >
                <Download size={16} /> {t('dl.qrDownload')}
              </button>
              <button
                onClick={() => setQrOpen(false)}
                className="px-4 py-2.5 rounded-xl font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
              >
                {t('dl.qrClose')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-8 md:bottom-8 bg-black text-white px-4 md:px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-300 z-50">
          <div className="bg-green-500 p-1 rounded-full">
            <CheckCircle2 size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold">{t('toast.title')}</p>
            <p className="text-xs text-gray-400">{t('toast.text')}</p>
          </div>
          <button onClick={() => setShowToast(false)} className="ml-4 text-gray-500 hover:text-white">
            &times;
          </button>
        </div>
      )}
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
        active
          ? 'bg-black text-white shadow-lg shadow-gray-200'
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
