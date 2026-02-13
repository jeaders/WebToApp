"use client";

import React, { useState } from 'react';
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
  Zap
} from 'lucide-react';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'upload' | 'preview' | 'settings' | 'logs' | 'download'>('upload');
  const [previewScale, setPreviewScale] = useState(100);
  const [previewDevice, setPreviewDevice] = useState<'iphone' | 'android'>('iphone');
  const [viewportWidth, setViewportWidth] = useState(375);
  const [viewportHeight, setViewportHeight] = useState(667);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState(0);
  const [appName, setAppName] = useState('Mia Fantastica App');
  const [appId, setAppId] = useState('com.tuonome.app');
  const [url, setUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#0070f3');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [showToast, setShowToast] = useState(false);
  const addLog = (message: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${time}] ${message}`]);
  };
  const [downloadLink, setDownloadLink] = useState<string | null>(null);
  const [githubToken, setGithubToken] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [cloudBuildStatus, setCloudBuildStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');

  const triggerCloudBuild = async () => {
    if (!githubToken || !githubRepo) {
      alert("Configura il tuo GitHub Token e Repository nelle impostazioni per la build cloud!");
      setActiveTab('settings');
      return;
    }

    setCloudBuildStatus('running');
    addLog("Innesco build cloud su GitHub Actions...");
    
    try {
      const response = await fetch('/api/github-build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token: githubToken, 
          repo: githubRepo,
          appName,
          appId
        }),
      });

      if (!response.ok) throw new Error("Errore durante l'invio della build");
      
      addLog("Build Cloud avviata! Monitora la tab Actions su GitHub.");
      // In un'app reale qui faremmo il polling dell'API di GitHub
    } catch (error: any) {
      addLog(`ERRORE CLOUD: ${error.message}`);
      setCloudBuildStatus('failed');
    }
  };

  const startBuild = async () => {
    if (!url && !selectedFile) {
      alert("Per favore, inserisci un URL o carica uno ZIP.");
      return;
    }
    
    setIsBuilding(true);
    setBuildProgress(0);
    setLogs([]);
    setDownloadLink(null);
    setActiveTab('logs'); 
    addLog("Inizializzazione build...");
    
    try {
      const formData = new FormData();
      formData.append('appName', appName);
      formData.append('appId', appId);
      formData.append('url', url);
      formData.append('primaryColor', primaryColor);
      if (selectedFile) formData.append('file', selectedFile);

      addLog("Invio dati al server...");
      
      const response = await fetch('/api/build', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Build failed');

      addLog("Configurazione Capacitor completata.");
      addLog("Generazione sorgenti app in corso...");
      
      let progress = 20;
      const interval = setInterval(() => {
        progress += 10;
        setBuildProgress(Math.min(progress, 90));
        if (progress === 40) addLog("Ottimizzazione WebView...");
        if (progress === 60) addLog("Creazione manifest nativo...");
        if (progress === 80) addLog("Impacchettamento progetto...");
      }, 500);

      setTimeout(() => {
        clearInterval(interval);
        setBuildProgress(100);
        setDownloadLink(data.downloadUrl);
        addLog("PROGETTO GENERATO CON SUCCESSO!");
        addLog(`Link download: ${data.downloadUrl}`);
        setIsBuilding(false);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000);
      }, 4000);

    } catch (error: any) {
      addLog(`ERRORE: ${error.message}`);
      setIsBuilding(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#f8f9fa]">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-100 flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg">
            <Smartphone className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">WebToApp</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={activeTab === 'upload'} 
            onClick={() => setActiveTab('upload')} 
          />
          <SidebarItem 
            icon={<Smartphone size={20} />} 
            label="Anteprima" 
            active={activeTab === 'preview'} 
            onClick={() => setActiveTab('preview')} 
          />
          <SidebarItem 
            icon={<Settings size={20} />} 
            label="Impostazioni App" 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')} 
          />
          <SidebarItem 
            icon={<History size={20} />} 
            label="Build Log" 
            active={activeTab === 'logs'} 
            onClick={() => setActiveTab('logs')} 
          />
          <SidebarItem 
            icon={<Download size={20} />} 
            label="Download" 
            active={activeTab === 'download'} 
            onClick={() => setActiveTab('download')} 
          />
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="bg-blue-50 p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={16} className="text-blue-600" />
              <span className="text-sm font-semibold text-blue-900">Piano MVP</span>
            </div>
            <p className="text-xs text-blue-700">Build illimitati per Android e iOS (Test Mode).</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-10 p-6">
          <div className="flex justify-between items-center max-w-5xl mx-auto">
            <h1 className="text-2xl font-semibold text-gray-900">
              {activeTab === 'upload' && 'Nuova Conversione'}
              {activeTab === 'preview' && 'Anteprima App'}
              {activeTab === 'settings' && 'Personalizza App'}
              {activeTab === 'logs' && 'Cronologia Build'}
              {activeTab === 'download' && 'Pacchetti Generati'}
            </h1>
            <div className="flex gap-4">
              <button 
                onClick={startBuild}
                disabled={isBuilding}
                className="bg-black text-white px-5 py-2 rounded-full font-medium hover:bg-gray-800 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isBuilding ? 'Compilazione...' : 'Avvia Build'}
                {!isBuilding && <Cpu size={18} />}
              </button>
            </div>
          </div>
        </header>

        <div className="p-8 max-w-5xl mx-auto space-y-8">
          {activeTab === 'upload' && (
            <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Suggerimenti Sicurezza & Performance */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe size={16} className="text-purple-500" />
                    <span className="text-sm font-bold">Free Cloud Build</span>
                  </div>
                  <p className="text-xs text-gray-500">Usa GitHub Actions per compilare APK e IPA gratuitamente senza Mac locale.</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={16} className="text-amber-500" />
                    <span className="text-sm font-bold">Sicurezza SSL</span>
                  </div>
                  <p className="text-xs text-gray-500">Abilita il pinning dei certificati per proteggere i dati nella WebView.</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap size={16} className="text-blue-500" />
                    <span className="text-sm font-bold">Ottimizzazione</span>
                  </div>
                  <p className="text-xs text-gray-500">Attiva ProGuard (R8) per ridurre le dimensioni del pacchetto finale.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Upload Section */}
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="mb-6">
                    <h3 className="text-lg font-bold mb-2">Sorgente Progetto</h3>
                    <p className="text-sm text-gray-500">Incolla un link o carica un archivio ZIP.</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="relative">
                      <Globe className="absolute left-3 top-3 text-gray-400" size={18} />
                      <input 
                        type="text" 
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://tuosito.it" 
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                      />
                    </div>
                    
                    <div className="flex items-center justify-center w-full">
                      <label className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${selectedFile ? 'border-primary bg-blue-50' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}>
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Upload className={`w-8 h-8 mb-4 ${selectedFile ? 'text-primary' : 'text-gray-400'}`} />
                          <p className="mb-2 text-sm text-gray-500 font-medium">
                            {selectedFile ? selectedFile.name : 'Trascina lo ZIP qui'}
                          </p>
                          <p className="text-xs text-gray-400">HTML, CSS, JS (Max 50MB)</p>
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
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center">
                  <div className="relative w-48 h-96 bg-gray-900 rounded-[3rem] border-8 border-gray-800 shadow-2xl overflow-hidden">
                    <div className="absolute top-0 w-full h-6 bg-gray-800 flex justify-center z-20">
                      <div className="w-20 h-4 bg-black rounded-b-xl"></div>
                    </div>
                    <div className="w-full h-full bg-white flex items-center justify-center overflow-hidden">
                      {url ? (
                        <iframe 
                          src={url.startsWith('http') ? url : `https://${url}`} 
                          className="w-full h-full border-none scale-[0.9] origin-top"
                          title="Preview"
                        />
                      ) : (
                        <div className="text-center p-4">
                          <Globe className="mx-auto mb-2 text-blue-200" size={40} />
                          <p className="text-xs text-blue-400 font-medium">Inserisci un URL per l'anteprima</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="mt-6 text-sm text-gray-500">Simulatore interattivo</p>
                </div>
              </div>

              {isBuilding && (
                <div className="bg-white p-6 rounded-2xl border border-blue-100 animate-pulse">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-semibold text-blue-900">Generazione bundle in corso...</span>
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
              {/* Sticky Controls Container */}
              <div className="sticky top-4 z-50 w-full max-w-2xl space-y-4 mb-12">
                {/* Device Selector & Zoom */}
                <div className="flex items-center justify-between bg-white/80 backdrop-blur-md p-3 rounded-2xl border border-gray-100 shadow-lg">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => { setPreviewDevice('iphone'); setViewportWidth(375); setViewportHeight(667); }}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${previewDevice === 'iphone' ? 'bg-black text-white' : 'hover:bg-gray-50'}`}
                    >
                      iPhone
                    </button>
                    <button 
                      onClick={() => { setPreviewDevice('android'); setViewportWidth(360); setViewportHeight(740); }}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${previewDevice === 'android' ? 'bg-black text-white' : 'hover:bg-gray-50'}`}
                    >
                      Android
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-gray-400 uppercase">Zoom Vista</span>
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

                {/* Resolution Controls */}
                <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-gray-100 shadow-lg grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Larghezza (Viewport)</label>
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
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Altezza (Viewport)</label>
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
                
                <div className="text-center">
                  <p className="text-[10px] text-gray-400 font-medium">
                    💡 <b>Info:</b> Questa è la risoluzione logica (viewport). Un iPhone 15 Pro ha 393px di larghezza logica, ma 1179px fisici (Retina 3x).
                  </p>
                </div>
              </div>

              {/* Professional Device Frame */}
              <div 
                className="relative transition-all duration-500"
                style={{ transform: `scale(${previewScale / 100})` }}
              >
                {previewDevice === 'iphone' ? (
                  /* iPhone 15 Pro Frame */
                  <div 
                    style={{ width: viewportWidth + 24, height: viewportHeight + 60 }}
                    className="bg-black rounded-[55px] p-3 shadow-2xl border-[6px] border-[#1f1f1f] relative overflow-hidden transition-all duration-300"
                  >
                    {/* Dynamic Island */}
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-20" />
                    
                    {/* Screen Content */}
                    <div className="w-full h-full bg-white rounded-[42px] overflow-hidden relative">
                      {url ? (
                        <iframe src={url.startsWith('http') ? url : `https://${url}`} className="w-full h-full border-none" title="App Preview" />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                          <div className="w-16 h-16 bg-gray-100 rounded-2xl mb-4 flex items-center justify-center">
                            <Globe size={32} className="text-gray-300" />
                          </div>
                          <p className="text-gray-400 text-sm font-medium">Inserisci un URL per vedere l'anteprima</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Android Pixel 8 Frame */
                  <div 
                    style={{ width: viewportWidth + 16, height: viewportHeight + 20 }}
                    className="bg-black rounded-[40px] p-2 shadow-2xl border-[4px] border-[#2a2a2a] relative overflow-hidden transition-all duration-300"
                  >
                    {/* Camera Hole */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#1a1a1a] rounded-full z-20" />
                    
                    {/* Screen Content */}
                    <div className="w-full h-full bg-white rounded-[32px] overflow-hidden relative">
                      {url ? (
                        <iframe src={url.startsWith('http') ? url : `https://${url}`} className="w-full h-full border-none" title="App Preview" />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                          <div className="w-16 h-16 bg-gray-100 rounded-2xl mb-4 flex items-center justify-center">
                            <Globe size={32} className="text-gray-300" />
                          </div>
                          <p className="text-gray-400 text-sm font-medium">Inserisci un URL per vedere l'anteprima</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Device Shadow Reflection */}
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-[80%] h-4 bg-black/10 blur-xl rounded-full" />
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <section className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-gray-700">Nome Applicazione</label>
                  <input 
                    type="text" 
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    placeholder="Mia Fantastica App" 
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" 
                  />
                </div>
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-gray-700">Package ID</label>
                  <input 
                    type="text" 
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="com.tuonome.app" 
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" 
                  />
                </div>
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-gray-700">Colore Principale</label>
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
                  <label className="block text-sm font-bold text-gray-700">Icona App (1024x1024)</label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400">
                      <Upload size={20} />
                    </div>
                    <button className="text-sm font-medium text-primary hover:underline">Carica nuova icona</button>
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-gray-100">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Globe size={20} className="text-purple-500" />
                  GitHub Cloud Compiler (Obbligatorio per APK/IPA)
                </h3>
                <div className="bg-purple-50/50 p-6 rounded-2xl border border-purple-100 space-y-4">
                  <p className="text-sm text-purple-800">
                    Per generare file APK e IPA installabili, inserisci il tuo <b>GitHub Personal Access Token</b> e il nome del <b>Repository</b>.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-purple-700">GitHub Token (con permessi 'workflow')</label>
                      <input 
                        type="password" 
                        value={githubToken}
                        onChange={(e) => setGithubToken(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxx" 
                        className="w-full p-3 bg-white border border-purple-200 rounded-xl text-sm" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-purple-700">Repository (utente/repo)</label>
                      <input 
                        type="text" 
                        value={githubRepo}
                        onChange={(e) => setGithubRepo(e.target.value)}
                        placeholder="tuo-utente/tuo-repo" 
                        className="w-full p-3 bg-white border border-purple-200 rounded-xl text-sm" 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Advanced Implementation: Deep Linking */}
              <div className="pt-8 border-t border-gray-100">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Zap size={20} className="text-blue-500" />
                  Configurazione Deep Linking (Avanzata)
                </h3>
                <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                  <p className="text-sm text-blue-800 mb-4">
                    Permetti alla tua app di aprirsi automaticamente quando gli utenti cliccano su link specifici del tuo sito.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" placeholder="Associazione Dominio (es. apple-app-site-association)" className="p-3 bg-white border border-blue-200 rounded-xl text-sm" />
                    <input type="text" placeholder="Android Asset Links" className="p-3 bg-white border border-blue-200 rounded-xl text-sm" />
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'logs' && (
            <div className="bg-black rounded-2xl p-6 font-mono text-xs text-green-400 min-h-[400px] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-300">
              <div className="flex gap-2 mb-4 border-b border-gray-800 pb-2 text-gray-500">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                <span className="ml-2 font-sans">Build Terminal</span>
              </div>
              <div className="space-y-1">
                {logs.length > 0 ? logs.map((log, i) => (
                  <p key={i}>{log}</p>
                )) : (
                  <p className="text-gray-600 italic">Nessun log disponibile. Avvia una build per vedere l'output.</p>
                )}
                {isBuilding && <p className="animate-pulse">_</p>}
              </div>
            </div>
          )}

          {activeTab === 'download' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {downloadLink ? (
                <div className="bg-white p-8 rounded-3xl border border-green-100 shadow-sm flex flex-col items-center text-center">
                  <div className="bg-green-50 p-4 rounded-full mb-4">
                    <CheckCircle2 size={40} className="text-green-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">App Pronta per il Download!</h3>
                  <p className="text-gray-500 mb-6 max-w-md">Abbiamo generato i sorgenti nativi della tua app. Puoi scaricare lo ZIP e caricarlo su GitHub per la build cloud o compilarlo localmente.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg">
                    <a 
                      href={downloadLink} 
                      download 
                      className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all"
                    >
                      <Download size={20} />
                      Scarica Sorgenti ZIP
                    </a>
                    <button 
                      onClick={triggerCloudBuild}
                      disabled={cloudBuildStatus === 'running'}
                      className="flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50"
                    >
                      <Cpu size={20} />
                      {cloudBuildStatus === 'running' ? 'Compilazione Cloud...' : 'Genera APK/IPA (GitHub)'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-12 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
                  <Download size={48} className="text-gray-200 mb-4" />
                  <h3 className="text-lg font-bold text-gray-400">Nessun download disponibile</h3>
                  <p className="text-sm text-gray-400">Avvia una build dalla dashboard per generare la tua app.</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DownloadCard platform="Android" format="APK / AAB" version="Cloud Build Required" />
                <DownloadCard platform="iOS" format="IPA / Xcode" version="Cloud Build Required" />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-8 right-8 bg-black text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-300 z-50">
          <div className="bg-green-500 p-1 rounded-full">
            <CheckCircle2 size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold">Build Completata!</p>
            <p className="text-xs text-gray-400">Il tuo pacchetto è pronto per il cloud.</p>
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

function DownloadCard({ platform, format, version }: any) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-2xl ${platform === 'Android' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-900'}`}>
          <Smartphone size={24} />
        </div>
        <div>
          <h4 className="font-bold text-gray-900">{platform}</h4>
          <p className="text-xs text-gray-500">{format} • v{version}</p>
        </div>
      </div>
      <button className="p-3 bg-gray-50 rounded-2xl hover:bg-gray-100 text-gray-700 transition-colors">
        <Download size={20} />
      </button>
    </div>
  );
}
