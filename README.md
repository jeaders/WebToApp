# WebToApp Platform MVP

Questa piattaforma permette di convertire siti web e progetti HTML/CSS/JS in app native Android e iOS utilizzando **Capacitor**.

## Stack Tecnologico
- **Frontend**: Next.js 14 (App Router), Tailwind CSS, Lucide Icons.
- **Backend**: API Routes (Node.js) per la gestione del build system.
- **Build Core**: Capacitor CLI.
- **Styling**: Minimalist SaaS UI con Shadcn-like components.

## Flusso di Funzionamento
1. **Input**: L'utente inserisce un URL o carica un file ZIP.
2. **Preparazione**: Il backend crea una cartella temporanea, inizializza un progetto Capacitor e configura `capacitor.config.json`.
3. **Asset Generation**: Viene utilizzato `@capacitor/assets` per generare icone e splash screen dalle immagini caricate.
4. **Compilazione**: 
   - Per Android: Viene eseguito `gradlew assembleRelease` via Docker.
   - Per iOS: Viene generato il progetto Xcode pronto per essere compilato su un Mac o tramite GitHub Actions.

## Funzionalità Avanzate Incluse
- **Deep Linking**: Configurazione per associazioni di dominio.
- **Preview Live**: Simulatore mockup integrato nella dashboard.
- **Build Logs**: Terminale simulato per il monitoraggio in tempo reale.
- **Sicurezza**: Suggerimenti per SSL Pinning e ProGuard.

## Come Avviare
```bash
npm install
npm run dev
```

## Build Gratuito e Illimitato (GitHub Actions)
Il progetto include due workflow GitHub Actions che costruiscono l'app con **Capacitor** senza bisogno di un Mac o di un server potente:

- **`.github/workflows/build.yml`** → costruisce l'**APK Android** (installabile). È il workflow usato dal pulsante "Genera APK (GitHub)".
- **`.github/workflows/build-ios.yml`** → opzionale, separato, costruisce una `.app` per **simulatore iOS** (nessuna influenza sulla build Android). Per un `.ipa` installabile servono account Apple Developer + certificati.

Il workflow Android è **auto-sufficiente**: installa Java, accetta le licenze dell'Android SDK, installa la piattaforma/build-tools richiesti (letti da `android/variables.gradle`), genera il progetto Capacitor con l'URL del sito e compila l'APK con `gradlew assembleDebug`.

### Prerequisiti per Cockpit → APK
1. **Actions attivo**: nel repo `jeaders/WebToApp` → *Settings → Actions → General* → *Allow all actions*. Il workflow è caricato, quindi lo trovi nella tab **Actions**.
2. **Personal Access Token** (classic) con scope **`workflow`** (e `repo` se il repo è privato). In alternativa un fine-grained token con *Contents: read* + *Actions: write*.
3. Nella dashboard: tab **Impostazioni App** → inserisci il token, il repo `jeaders/WebToApp`, l'**URL** del sito. Poi tab **Download** → **Genera APK (GitHub)**.
4. Al termine, scarica l'artifact **`app-debug-<run_id>`** dalla run nella tab **Actions**.

> Nota: la **build cloud supporta solo la modalità URL** (un sito online). La modalità **ZIP** genera un progetto sorgente scaricabile da compilare in locale. L'app carica il sito direttamente nella WebView nativa (`server.url`), quindi funziona anche con siti che bloccano l'iframe.

### Trigger manuale (senza dashboard)
Tab **Actions → Build Mobile Apps → Run workflow** e inserisci *App name*, *Package ID* e *URL del sito*.

## Note per lo Sviluppatore
- **iOS IPA**: Per generare un file `.ipa` installabile direttamente, dovrai aggiungere i segreti `APPLE_CERTIFICATE` e `APPLE_PROVISIONING_PROFILE` e configurare Fastlane nel workflow.
- **Android Signing**: L'APK generato è "unsigned". Per pubblicarlo sul Play Store, dovrai firmarlo usando `apksigner` o configurare il keystore nei segreti di GitHub.
