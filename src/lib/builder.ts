import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export interface BuildOptions {
  appName: string;
  appId: string;
  url?: string;
  zipPath?: string;
  primaryColor: string;
}

export async function prepareBuild(options: BuildOptions) {
  const buildId = `${options.appId}-${Date.now()}`;
  const buildDir = path.join(process.cwd(), 'temp_builds', buildId);
  
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  // 1. Create a dummy web project or extract ZIP
  const webDir = path.join(buildDir, 'www');
  if (!fs.existsSync(webDir)) fs.mkdirSync(webDir);

  if (options.zipPath) {
    const zip = new AdmZip(options.zipPath);
    zip.extractAllTo(webDir, true);
    // Remove the temp zip after extraction
    try { fs.unlinkSync(options.zipPath); } catch (e) {}
  } else if (options.url) {
    fs.writeFileSync(path.join(webDir, 'index.html'), `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
          <title>${options.appName}</title>
          <style>
            body, html, iframe { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; background: ${options.primaryColor}; }
            iframe { border: none; }
          </style>
        </head>
        <body>
          <iframe src="${options.url}" style="width:100%;height:100%;" allow="geolocation; microphone; camera; midi; encrypted-media;"></iframe>
        </body>
      </html>
    `);
  }

  // 2. Generate package.json for the project
  const packageJson = {
    name: options.appName.toLowerCase().replace(/\s+/g, '-'),
    version: "1.0.0",
    dependencies: {
      "@capacitor/core": "^5.0.0",
      "@capacitor/android": "^5.0.0",
      "@capacitor/ios": "^5.0.0"
    }
  };
  fs.writeFileSync(path.join(buildDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  // 3. Generate capacitor.config.json
  const capConfig = {
    appId: options.appId,
    appName: options.appName,
    webDir: 'www',
    bundledWebRuntime: false,
    server: options.url ? { url: options.url, cleartext: true } : undefined,
    plugins: {
      SplashScreen: {
        launchShowDuration: 3000,
        backgroundColor: options.primaryColor,
        androidScaleType: "CENTER_CROP",
        showSpinner: true
      }
    }
  };
  fs.writeFileSync(path.join(buildDir, 'capacitor.config.json'), JSON.stringify(capConfig, null, 2));

  // 4. Create ZIP for download
  const projectZip = new AdmZip();
  projectZip.addLocalFolder(buildDir);
  
  const outputDir = path.join(process.cwd(), 'public', 'downloads');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  
  const zipName = `${buildId}.zip`;
  const zipPath = path.join(outputDir, zipName);
  projectZip.writeZip(zipPath);

  return {
    success: true,
    message: "App project generated successfully",
    downloadUrl: `/downloads/${zipName}`,
    buildId: buildId
  };
}
