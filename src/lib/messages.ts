// Messaggi di errore lato server, localizzati. Le API ricevono "lang" dal client
// e rispondono con il testo nella lingua scelta dall'utente.
type MsgKey =
  | "needInput"
  | "notConfigured"
  | "missingCreds"
  | "badRepo"
  | "wfNotFound"
  | "tooBig"
  | "busy"
  | "serverless"
  | "notReady"
  | "noArtifact"
  | "missingParams";

const messages: Record<"en" | "it", Record<MsgKey, string>> = {
  en: {
    needInput: "Please enter a URL or upload a ZIP.",
    notConfigured:
      "Service not configured: WEBTOAPP_GITHUB_TOKEN / WEBTOAPP_GITHUB_REPO are missing on the server.",
    missingCreds: "Token or repository missing.",
    badRepo: 'Invalid repo format. Use "user/repo".',
    wfNotFound:
      'Workflow "build.yml" not found. Enable Actions (Settings → Actions → Allow all) and make sure the file is on main.',
    tooBig: "ZIP too large (max ~45MB).",
    busy: "The service is very busy: too many builds running or in the last hours. Try again in a few minutes.",
    serverless:
      'Generating the local source ZIP is not available on this serverless deployment. Use "Generate APK (GitHub)" from the Download tab.',
    notReady: "The build has not completed successfully yet.",
    noArtifact: "No artifact found for this run.",
    missingParams: "Missing parameters.",
  },
  it: {
    needInput: "Inserisci un URL oppure carica uno ZIP.",
    notConfigured:
      "Servizio non configurato: manca WEBTOAPP_GITHUB_TOKEN / WEBTOAPP_GITHUB_REPO sul server.",
    missingCreds: "Token o repository mancanti.",
    badRepo: 'Formato repo non valido. Usa "utente/repo".',
    wfNotFound:
      'Workflow "build.yml" non trovato. Attiva Actions (Settings → Actions → Allow all) e assicurati che il file sia su main.',
    tooBig: "ZIP troppo grande (max ~45MB).",
    busy: "Servizio molto occupato: troppe build in corso o nelle ultime ore. Riprova tra qualche minuto.",
    serverless:
      'La generazione dello ZIP sorgente locale non è disponibile su questo deploy serverless. Usa "Genera APK (GitHub)" dalla tab Download.',
    notReady: "La build non è ancora completata con successo.",
    noArtifact: "Nessun artifact trovato per questa run.",
    missingParams: "Parametri mancanti.",
  },
};

export function msg(lang: string | undefined | null, key: MsgKey): string {
  const l = lang === "it" ? "it" : "en";
  return messages[l][key];
}
