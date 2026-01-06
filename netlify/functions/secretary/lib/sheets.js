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

  const values = res.data.values || [];
  const header = values[0] || [];
  const data = values.slice(1);

  return { header, data };
}

async function updateTaskCell(rowIndex1Based, colIndex1Based, value) {
  const spreadsheetId = await getTasksSheetId();

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  // Convert row/col to A1 notation by updating a single-cell range via grid indices is more work;
  // easiest MVP: use values.update with explicit range like Tasks!L5 if we compute column letter.
  const colToLetter = (n) => {
    let s = "";
    while (n > 0) {
      const m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };

  const colLetter = colToLetter(colIndex1Based);
  const range = `Tasks!${colLetter}${rowIndex1Based}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[value]] }
  });
}

module.exports = { appendTaskRow, getAllTasks, updateTaskCell };
