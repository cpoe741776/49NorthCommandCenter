const { google } = require("googleapis");

function getAuth() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!clientEmail || !privateKey) throw new Error("Missing Google service account env vars");

  // Netlify often stores multiline keys with literal \n
  privateKey = privateKey.replace(/\\n/g, "\n");

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
}

async function appendTaskRow(values) {
  const spreadsheetId = process.env.SECRETARY_TASKS_SHEET_ID;
  if (!spreadsheetId) throw new Error("Missing SECRETARY_TASKS_SHEET_ID");

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Tasks!A:A",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] }
  });
}

async function getAllTasks() {
  const spreadsheetId = process.env.SECRETARY_TASKS_SHEET_ID;
  if (!spreadsheetId) throw new Error("Missing SECRETARY_TASKS_SHEET_ID");

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Tasks!A:N"
  });

  const rows = resp.data.values || [];
  const [header, ...data] = rows;
  return { header, data };
}

async function updateTaskCell(a1, value) {
  const spreadsheetId = process.env.SECRETARY_TASKS_SHEET_ID;
  if (!spreadsheetId) throw new Error("Missing SECRETARY_TASKS_SHEET_ID");

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: a1,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[value]] }
  });
}

module.exports = { appendTaskRow, getAllTasks, updateTaskCell };
