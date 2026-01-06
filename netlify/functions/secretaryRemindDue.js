let impl;
try {
  impl = require("./secretary/remind-due.js");
} catch (e) {
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
    return await impl.handler(event, context);
  } catch (e) {
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
