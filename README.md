# WebToApp — Converti il tuo sito in un'APK Android

Piattaforma che trasforma un **sito web** (o un progetto **HTML/CSS/JS** in ZIP) in un'**app Android nativa** usando [Capacitor](https://capacitorjs.com). Il caricamento avviene dentro una **WebView nativa**, quindi funziona anche con i siti che bloccano l'iframe (`X-Frame-Options` / `frame-ancestors`). La compilazione dell'APK avviene su **GitHub Actions** (gratis per i repo pubblici).

## Cosa fa

- **Modalità URL**: incolli l'indirizzo di un sito → l'app lo carica direttamente nella WebView (`server.url`).
- **Modalità ZIP**: carichi un archivio `.zip` con la tua app HTML/JS → i file vengono impacchettati nell'APK come app statica locale (nessuna connessione necessaria a runtime).
- **iOS** (opzionale, workflow separato): genera una `.app` per simulatore (vedi sotto).

Al termine scarichi l'**APK installabile** direttamente dalla dashboard (o dagli *Artifacts* della run su GitHub).

---

## Avvio in locale

```bash
npm install
npm run dev
# apri http://localhost:3000
```

Requisiti: Node 18+ (consigliato 20/22). Non serve Android SDK in locale: la compilazione gira su GitHub.

---

## Come generare l'APK (procedura utente)

1. **Prerequisito — attiva Actions** sul repo: `Settings → Actions → General → Allow all actions`.
2. **Crea un Personal Access Token (classic)** con scope **`workflow`** e **`repo`**  
   (da github.com → Settings → Developer settings → Personal access tokens → Tokens (classic)).  
   In alternativa un *fine-grained token* con permessi **Contents: read** e **Actions: write**.
3. Nella dashboard:
   - Tab **Nuova Conversione**: inserisci l'**URL** del sito **oppure** carica uno **ZIP**.
   - Tab **Impostazioni App**: imposta Nome app, Package ID (es. `com.tuonome.app`), e nella sezione *GitHub Cloud Compiler* inserisci il **token** e il **repository** nel formato `utente/repo` (es. `jeaders/WebToApp`).
4. Tab **Download** → **Genera APK (GitHub)**.
5. Attendi: la dashboard mostra lo stato e, a build completata, compare il pulsante **Scarica APK**.

> La build cloud in **modalità ZIP** necessita di uno ZIP; in **modalità URL** serve l'indirizzo del sito. Lo ZIP ha priorità se carichi un file.

---

## I due workflow (GitHub Actions)

- **`Build Mobile Apps`** (`.github/workflows/build.yml`) → costruisce l'**APK Android**. Usato dal pulsante *Genera APK (GitHub)*. È auto-sufficiente: installa Node, Java 21, accetta le licenze dell'Android SDK, installa la piattaforma/build-tools richiesti, genera il progetto Capacitor e compila con `gradlew assembleDebug`.
- **`Build iOS App`** (`.github/workflows/build-ios.yml`) → **separato e opzionale**, costruisce una `.app` per **simulatore** senza firma. Non influisce sulla build Android.

Puoi anche avviare la build Android manualmente: tab **Actions → Build Mobile Apps → Run workflow** e compila *App name*, *Package ID* e *URL*.

---

## Note su firma, release e limiti

- L'APK prodotto è in **debug** (firmato con la debug key, quindi **installabile** via sideload). Per pubblicarlo sul Play Store serve una **release firmata** con il tuo keystore.
- **iOS**: per un `.ipa` installabile su dispositivo servono un account **Apple Developer** e i certificati/provisioning. Il workflow incluso produce solo una build da simulatore.
- **Gratis**: GitHub Actions è **gratuito e illimitato per i repo pubblici**. Gli artifact restano disponibili **14 giorni**.
- **Branch `ci-build`** (solo modalità ZIP): la dashboard ci committa `builds/site.zip` e avvia la build su quel branch. Viene ri-creato/azzerato a ogni build dallo stato di `main`; puoi cancellarlo quando vuoi.

---

## Deploy su Netlify (produzione)

Puoi pubblicare la dashboard su **Netlify**. Attenzione: **Netlify non compila l'APK** — ospita solo la dashboard e le API che *avviano* la build. La compilazione gira su **GitHub Actions**.

1. Fai il push del repo su GitHub (branch `main`).
2. Su Netlify: **Add new site → Import an existing project** → seleziona il repo.
3. Build command: `npm run build` (già impostato in `netlify.toml`). **Non servono variabili d'ambiente**: il token GitHub lo inserisce l'utente a runtime dalla dashboard e non viene mai salvato nel sito.
4. Deploy. Dalla tab **Download → Genera APK (GitHub)** avvii la build e, a fine compilazione, scarichi l'APK.

**Cosa cambia su Netlify (serverless):**
- ✅ La build APK via **GitHub Actions** funziona (sia **URL** sia **ZIP**).
- ⚠️ La generazione dello **ZIP sorgente locale** è **disattivata** (il filesystem serverless è di sola lettura): su Netlify resta solo il percorso cloud.
- ⚡ Le funzioni rispondono **subito** dopo l'avvio della build (nessuna attesa lunga), così non scattano i timeout delle funzioni Netlify; lo stato viene letto con chiamate brevi separate.

> Per ricevere l'APK serve comunque un **token GitHub** e un **repo** configurati (la build gira sul tuo account/repo). GitHub Actions è **gratis** per i repo pubblici.

---

## 🔒 Privacy e sicurezza (importante)

- **Il token GitHub non viene mai salvato né committato.** Viene usato solo in memoria durante la richiesta di build, dal browser, e non viene scritto su disco né inserito nel repository.
- **Nessun segreto è presente nel codice.** Il token lo inserisce l'utente a runtime.
- I file **generati e personali sono in `.gitignore`** (non finiscono nel repo): `.env*`, `secrets.json`, `android/`, `ios/`, `www/`, `builds/`, `capacitor.config.json|ts|js|mjs`. Così, se più persone usano la piattaforma, l'URL/sito di uno non viene committato nel repo condiviso.
- **Repo pubblico o privato?** Il progetto è utilizzabile così com'è. Se vuoi tenere tutto riservato, imposta il repo su **privato**: `Settings → General → Danger Zone → Change repository visibility → Private`. Il workflow continua a funzionare (usa il tuo token).
- **Non committare mai** il tuo Personal Access Token. Se lo hai esposto, revocalo nelle impostazioni GitHub.

---

## Struttura del progetto

```
.github/workflows/build.yml        # build APK Android (auto-sufficiente)
.github/workflows/build-ios.yml    # build iOS (simulatore, opzionale)
src/app/page.tsx                   # dashboard
src/app/api/build/route.ts         # genera il progetto sorgente (ZIP) in locale
src/app/api/github-build/route.ts  # avvia la build cloud (URL o ZIP) su GitHub Actions
src/app/api/cloud-status/route.ts  # stato della run
src/app/api/cloud-artifact/route.ts# scarica l'APK dall'artifact
src/lib/github.ts                  # helper API GitHub (commit, dispatch, artifact)
src/lib/builder.ts                 # prepara il progetto Capacitor (builder locale)
```

---

## Risoluzione problemi

- **"Workflow build.yml non trovato"** → Actions non è attivo oppure il file non è su `main`. Attiva Actions e premi *Run workflow* una volta dalla tab Actions.
- **L'app mostra solo "Loading…"** → non dovrebbe più accadere: il workflow verifica che `server.url` sia presente nella config nativa e fallisce la build se manca. Se usi uno ZIP, assicurati che contenga `index.html` nella root (o in un'unica cartella di primo livello).
- **Errore licenze/SDK Android** → lo step *Setup Android SDK* le accetta in automatico.
- **La build cloud con ZIP fallisce** → verifica che lo ZIP contenga un `index.html` e sia < ~45MB.
- **DNS/rete intermittente** durante il download → riprova (il build su GitHub è indipendente).

---

## Stack

Next.js 14 (App Router), TypeScript, Tailwind CSS, Capacitor 8, Octokit (GitHub API), AdmZip.
