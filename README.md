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
Per compilare l'app gratuitamente (senza bisogno di un Mac o di un server potente):
1. Carica questo progetto su un repository GitHub.
2. Vai nella tab **Actions**.
3. Seleziona il workflow **Build Mobile Apps**.
4. Clicca su **Run workflow** inserendo il nome dell'app e il package ID.
5. Al termine, scarica l'APK (Android) o l'archivio Xcode (iOS) dagli "Artifacts" della build.

## Note per lo Sviluppatore
- **iOS IPA**: Per generare un file `.ipa` installabile direttamente, dovrai aggiungere i segreti `APPLE_CERTIFICATE` e `APPLE_PROVISIONING_PROFILE` e configurare Fastlane nel workflow.
- **Android Signing**: L'APK generato è "unsigned". Per pubblicarlo sul Play Store, dovrai firmarlo usando `apksigner` o configurare il keystore nei segreti di GitHub.
