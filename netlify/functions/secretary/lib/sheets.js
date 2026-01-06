const { google } = require("googleapis");
const { getSecret } = require("../../_utils/secrets");

function getAuth() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) throw new Error("Missing GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY");
  privateKey = privateKey.replace(/\\n/g, "\n");

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
}

async function getTasksSheetId() {
  // Stored in COMPANY_DATA_SHEET_ID -> 49N_Secrets tab
  return await getSecret("SECRETARY_TASKS_SHEET_ID");
}

async function appendTaskRow(values) {
  const spreadsheetId = await getTasksSheetId();

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
  const spreadsheetId = await getTasksSheetId();

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Tasks!A:M"
  });

  const rows = res.data.values || [];
  const header = rows[0] || [];
  const data = rows.slice(1);

  return { header, data };
}

module.exports = { appendTaskRow, getAllTasks };
