<div align="center">

# WebToApp

### Turn any website into a native Android app — in one click.

[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Android-green.svg)](#)
[![Build](https://img.shields.io/badge/Build-GitHub%20Actions-blue.svg)](#)
[![Author](https://img.shields.io/badge/Author-Alex%20Mirici-black.svg)](https://alexmirici.netlify.app)

**Copyright © 2026 Alex Mirici — Web Developer.**

</div>

---

WebToApp is a platform that converts any **website (URL)** or **static HTML/CSS/JS project (ZIP)** into an installable **Android APK** using [Capacitor](https://capacitorjs.com). The site runs inside a native **WebView**, so it works even with sites that block iframes. The APK is compiled on **GitHub Actions** (free for public repositories), and the dashboard is hosted on **Netlify**.

---

## ✨ Features

- 🔗 **URL mode** — wrap any live website into a native app.
- 📦 **ZIP mode** — package a static site (HTML/CSS/JS) as an offline-capable app.
- ⚡ **One-click build** — the visitor only pastes a link; everything else is automatic.
- ☁️ **Cloud build** — powered by GitHub Actions, no local Android toolchain needed.
- 🔐 **Server-side token** — visitors never enter credentials; the owner configures the token once.
- 🛡️ **Anti-abuse** — automatic build throttling protects your Actions quota.
- 🔒 **Privacy-first** — no secrets are ever committed; the token stays on the server.

---

## 🧠 How it works

```
Visitor (browser)
   │  pastes URL / uploads ZIP
   ▼
Netlify  ── hosts the dashboard + API routes (Next.js)
   │  triggers a build (GitHub API, server-side token)
   ▼
GitHub Actions  ── generates a Capacitor project & compiles the APK
   │
   ▼
Artifact (.apk)  ── downloaded directly from the dashboard
```

Netlify **does not** compile the app — it only hosts the dashboard and triggers the build. The actual compilation runs on GitHub Actions.

---

## 🚀 Getting started (local development)

**Requirements:** Node.js 18+ (20/22 recommended). No Android SDK required locally.

```bash
npm install
npm run dev
# open http://localhost:3000
```

---

## ⚙️ Configuration (site owner — one time)

So that visitors only need to paste a URL, configure the GitHub token **on the server** (never in the browser or in the repository).

Create a **classic Personal Access Token** with scopes **`repo`** and **`workflow`**, then set these **environment variables** on Netlify
(*Site settings → Build & deploy → Environment → Environment variables*, scope **All scopes**):

| Variable                 | Value                                            |
| ------------------------ | ------------------------------------------------ |
| `WEBTOAPP_GITHUB_TOKEN`  | Your GitHub PAT (secret, server-only)            |
| `WEBTOAPP_GITHUB_REPO`   | `jeaders/WebToApp` (or your `user/repo`)         |

Then **redeploy** (*Deploys → Trigger deploy → Clear cache and deploy site*). Verify by opening `/api/config` — it should return `{"configured":true,...}`. From that point the dashboard shows *"Build cloud already configured"* and the token fields disappear.

> 🔁 **Anti-abuse:** since any visitor can start a build on your account, the service enforces a limit (max **2 concurrent builds** and **40/hour**). Beyond that, builds are rejected with a "try later" message.

For local development you can copy `.env.example` to `.env` (already git-ignored).

---

## 🖱️ Using the platform (visitor)

1. Open the dashboard.
2. **New Conversion** tab: paste a **URL** _or_ upload a **ZIP**.
3. (Optional) **App Settings**: customize the app name and package ID (e.g. `com.yourname.app`).
4. **Download** tab → **Generate APK (GitHub)**.
5. Wait for the build, then click **Download APK** when it is ready.

> The URL is normalized automatically (typing `example.com` becomes `https://example.com`).

---

## ☁️ Deployment on Netlify

- **Build command:** `npm run build` (set in `netlify.toml`).
- **No build-time secrets:** the GitHub token is entered at runtime as an environment variable, never committed.
- **Auto-deploy on every push:** link the repository in Netlify (Import from GitHub) — Netlify redeploys automatically on each push to `main`. Alternatively, create a **Build Hook** in Netlify and store its URL as the GitHub **Actions secret** `NETLIFY_BUILD_HOOK_URL`; the workflow `.github/workflows/netlify-deploy.yml` calls it on every push.

**Serverless notes:**
- ✅ The GitHub-Actions APK build works (URL and ZIP).
- ⚠️ The local "source ZIP" generator is **disabled** on serverless (read-only filesystem); only the cloud build is available.
- ⚡ API routes respond immediately (no long waits), so Netlify function timeouts are never hit.

---

## 📱 iOS

iOS is **not** part of this service yet. A distributable `.ipa` requires a paid **Apple Developer** account plus signing certificates and a macOS runner, so it is out of scope for now.

---

## 🔏 Release signing & app icons

The APK is **signed with your own release key** (so it installs as a trusted app) and gets **custom icons + splash screen**.

**Icons / splash:** the source artwork lives in [`assets/icon.png`](./assets/icon.png) (1024×1024) and [`assets/splash.png`](./assets/splash.png) (2732×2732). They are rendered into all Android densities automatically via `@capacitor/assets` at build time. To use your own logo, just replace those two files and rebuild.

**Release signing (one-time):** create these **GitHub Actions secrets**
(*repo → Settings → Secrets and variables → Actions → New repository secret*):

| Secret                     | Value                                             |
| -------------------------- | ------------------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`  | base64 of your `.jks`/`.keystore` file            |
| `ANDROID_KEY_ALIAS`        | key alias (e.g. `webtoapp`)                       |
| `ANDROID_KEYSTORE_PASSWORD`| keystore password                                 |
| `ANDROID_KEY_PASSWORD`     | key password                                      |

When these secrets are present, the workflow builds a **signed release APK**. If they are **not** set, it safely falls back to the debug build (so the pipeline never breaks).

> 🔐 **Keep your keystore and passwords safe.** They are stored only locally in the git-ignored file `_private.local.md` (and `android-keystore.local.jks`). You need the **same** key to publish updates to the Play Store — losing it means you can't update an already-published app.
>
> ℹ️ **Important note about the install warning:** a properly signed APK removes the "file may be harmful / unknown app" risk during install. Google **Play Protect** may still show a generic warning for *brand-new* sideloaded apps until the app gains reputation — this is normal for apps not distributed via the Play Store and is not related to signing.

---

## 🔒 Security & privacy

- The GitHub token lives **only on the server** (environment variable) and is **never** sent to the browser.
- No token or secret is committed to the repository or to `netlify.toml`.
- Generated/personal files are git-ignored: `.env*` (except `.env.example`), `*.local.md`, `android/`, `ios/`, `www/`, `builds/`, `capacitor.config.*`.
- If a token is ever exposed, revoke it immediately in your GitHub settings.

---

## 🗂️ Project structure

```
.github/workflows/build.yml          # Android APK build (self-contained)
.github/workflows/build-ios.yml      # iOS simulator build (optional, separate)
.github/workflows/netlify-deploy.yml # Auto-deploy to Netlify on push
netlify.toml                         # Netlify build config
src/app/page.tsx                     # Dashboard UI
src/app/api/build/route.ts           # Local source-project builder (dev only)
src/app/api/github-build/route.ts    # Starts the cloud build (URL or ZIP)
src/app/api/cloud-latest/route.ts    # Discovers / follows the build run
src/app/api/cloud-status/route.ts    # Build status
src/app/api/cloud-artifact/route.ts  # Downloads the APK from the artifact
src/app/api/config/route.ts          # Reports whether the service is configured
src/lib/github.ts                    # GitHub API helpers + server config
src/lib/builder.ts                   # Capacitor project generator (local)
```

---

## 🛠️ Troubleshooting

- **"Build cloud not configured"** → set `WEBTOAPP_GITHUB_TOKEN` and `WEBTOAPP_GITHUB_REPO` on Netlify and redeploy.
- **App shows only "Loading…"** → should not happen; the build verifies the runtime config and fails loudly if broken.
- **Build fails on ZIP** → make sure the archive contains an `index.html` (root or a single top-level folder) and is under ~45 MB.
- **Old APK crashes on launch** → regenerate the APK; older builds created before URL normalization (`https://`) crashed on some devices.

---

## 📄 License

This project is released under the **MIT License**. See [LICENSE](./LICENSE).

**Copyright © 2026 Alex Mirici — Web Developer.**

Third-party open-source dependencies (Next.js, React, Capacitor, Tailwind CSS, Octokit, AdmZip, …) remain governed by their own respective licenses.
