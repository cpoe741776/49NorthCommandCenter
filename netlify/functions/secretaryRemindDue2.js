// netlify/functions/secretaryRemindDue2.js
exports.handler = async (event, context) => {
  try {
    // Require INSIDE handler so require errors don't become Netlify "Internal Error"
    const impl = require("./secretary/remind-due2-impl.js");
    return await impl.handler(event, context);
  } catch (err) {
    console.error("SECRETARY_REMIND_DUE2_BOOTSTRAP_ERROR", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        stage: "bootstrap",
        error: String(err && err.message ? err.message : err),
        stack: err && err.stack ? String(err.stack) : null
      })
    };
  }
};
