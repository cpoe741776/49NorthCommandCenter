// netlify/functions/deleteDocument.js
const { google } = require('googleapis');
const { getGoogleAuth, driveClient, sheetsClient } = require('./_utils/google');
const { corsHeaders, methodGuard, safeJson, ok, bad, unauth, serverErr, checkAuth } = require('./_utils/http');

const SHEET_ID = process.env.COMPANY_DATA_SHEET_ID;

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);

  const guard = methodGuard(event, headers, 'POST', 'OPTIONS');
  if (guard) return guard;

  if (!checkAuth(event)) return unauth(headers);

  if (!SHEET_ID) return bad(headers, 'COMPANY_DATA_SHEET_ID not set');

  const [body, parseErr] = safeJson(event.body);
  if (parseErr) return bad(headers, 'Invalid JSON');

  const { documentId, driveFileId } = body || {};
  if (!documentId) return bad(headers, 'Missing documentId');
  // driveFileId is optional—if missing, we’ll only delete the sheet row

  try {
    const auth = getGoogleAuth();
    await auth.getClient(); // Use getClient() instead of deprecated authorize()

    // 1) Try to delete the Drive file first (non-fatal if it fails)
    if (driveFileId) {
      try {
        const drive = driveClient(auth);
        await drive.files.delete({ fileId: driveFileId });
      } catch (e) {
        // Log but do not fail: user may have manually deleted it in Drive
        console.warn('deleteDocument: drive delete failed:', e.message);
      }
    }

    // 2) Delete the sheet row from CompanyDocuments
    const sheets = sheetsClient(auth);

    // We need the sheetId (gid) of "CompanyDocuments" tab to issue a batchUpdate deleteDimension
    const spreadsheet = await google.sheets({ version: 'v4', auth }).spreadsheets.get({
      spreadsheetId: SHEET_ID,
    });

    const companyDocsSheet = (spreadsheet.data.sheets || []).find(
      (s) => s.properties && s.properties.title === 'CompanyDocuments'
    );
    if (!companyDocsSheet) return bad(headers, 'CompanyDocuments sheet not found');

    const sheetId = companyDocsSheet.properties.sheetId;

    // documentId is the row number (1-based). Delete exactly that row.
    // Sheets API deleteDimension uses 0-based, endIndex exclusive.
    const rowNumber = Number(documentId);
    if (!Number.isInteger(rowNumber) || rowNumber < 2) {
      // We never allow deleting header row
      return bad(headers, 'Invalid documentId/row number');
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: rowNumber - 1, // inclusive
                endIndex: rowNumber,       // exclusive
              },
            },
          },
        ],
      },
    });

    return ok(headers, { success: true });
  } catch (e) {
    console.error('deleteDocument error:', e);
    return serverErr(headers, 'Failed to delete document');
  }
};
