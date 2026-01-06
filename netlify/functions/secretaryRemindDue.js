console.log("WRAPPER secretaryRemindDue LOADED 2026-01-06-C");

let impl;
try {
  impl = require("./secretary/remind-due.js");
  console.log("WRAPPER secretaryRemindDue: remind-due.js required OK");
} catch (e) {
  console.log("WRAPPER secretaryRemindDue: require failed", e && e.stack ? e.stack : e);

  exports.handler = async () => ({
    statusCode: 500,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ok: false,
      stage: "require(./secretary/remind-due.js)",
      error: String(e && e.message ? e.message : e),
      stack: e && e.stack ? String(e.stack) : null
    })
  });
  return;
}

exports.handler = async (event, context) => {
  try {
    const res = await impl.handler(event, context);

    // If impl returns something invalid, surface it instead of Netlify "Internal Error"
    if (!res || typeof res.statusCode !== "number") {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, stage: "impl.handler", error: "Invalid response object", got: res })
      };
    }

    if (typeof res.body !== "string") res.body = JSON.stringify(res.body ?? "");
    return res;
  } catch (e) {
    console.log("WRAPPER secretaryRemindDue: impl.handler threw", e && e.stack ? e.stack : e);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        stage: "impl.handler",
        error: String(e && e.message ? e.message : e),
        stack: e && e.stack ? String(e.stack) : null
      })
    };
  }
};
