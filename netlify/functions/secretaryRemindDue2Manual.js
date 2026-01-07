// netlify/functions/secretaryRemindDue2Manual.js
// Manual wrapper to surface bundle/init errors as JSON.

exports.handler = async (event) => {
  try {
    const mod = require("./secretaryRemindDue2");
    if (!mod || typeof mod.handler !== "function") {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: "secretaryRemindDue2.handler not found" }),
      };
    }
    return await mod.handler(event);
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: String(err?.message || err),
        stack: String(err?.stack || ""),
      }),
    };
  }
};
