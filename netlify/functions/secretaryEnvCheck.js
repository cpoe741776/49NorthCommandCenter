const { getSecret } = require("./_utils/secrets");

exports.handler = async () => {
  try {
    const keys = [
      "SECRETARY_TASKS_SHEET_ID",
      "PUSHOVER_APP_TOKEN",
      "PUSHOVER_USER_KEY"
    ];

    const found = {};
    for (const k of keys) {
      const v = await getSecret(k);
      found[k] = v ? `ok (${v.length} chars)` : "missing";
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        bootstrap: {
          COMPANY_DATA_SHEET_ID: !!process.env.COMPANY_DATA_SHEET_ID,
          GOOGLE_CLIENT_EMAIL: !!process.env.GOOGLE_CLIENT_EMAIL,
          GOOGLE_PRIVATE_KEY: !!process.env.GOOGLE_PRIVATE_KEY
        },
        secrets: found
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
