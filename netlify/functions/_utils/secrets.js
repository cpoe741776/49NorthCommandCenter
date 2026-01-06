const { google } = require("googleapis");

// Cache per warm lambda
let cache = { loadedAt: 0, ttlMs: 5 * 60 * 1000, map: null };

function getAuth() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!clientEmail || !privateKey) throw new Error("Missing GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY");
  privateKey = privateKey.replace(/\\n/g, "\n");

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  });
}

async function loadSecrets() {
  const spreadsheetId = process.env.COMPANY_DATA_SHEET_ID;
  if (!spreadsheetId) throw new Error("Missing COMPANY_DATA_SHEET_ID");

  const tab = "49N_Secrets";

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!A:E`
  });

  const rows = res.data.values || [];
  if (rows.length < 2) return new Map();

  const [header, ...data] = rows;
  const idx = (name) => header.indexOf(name);

  const keyIdx = idx("key");
  const valIdx = idx("value");
  const enabledIdx = idx("enabled");

  const m = new Map();
  for (const r of data) {
    const k = String(r[keyIdx] || "").trim();
    if (!k) continue;

    const enabledRaw = String(r[enabledIdx] ?? "TRUE").trim().toLowerCase();
    const enabled = enabledRaw !== "false" && enabledRaw !== "0" && enabledRaw !== "no";
    if (!enabled) continue;

    const v = String(r[valIdx] || "");
    m.set(k, v);
  }

  return m;
}

async function getSecret(key) {
  const now = Date.now();
  const fresh = cache.map && (now - cache.loadedAt) < cache.ttlMs;

  if (!fresh) {
    cache.map = await loadSecrets();
    cache.loadedAt = now;
  }

  if (!cache.map.has(key)) throw new Error(`Secret not found: ${key}`);
  return cache.map.get(key);
}

module.exports = { getSecret };
