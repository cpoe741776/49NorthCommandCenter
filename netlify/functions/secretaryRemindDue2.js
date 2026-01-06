console.log("WRAPPER secretaryRemindDue2 LOADED 2026-01-06-D");

let impl;
try {
  impl = require("./secretary/remind-due2-impl.js");
  console.log("WRAPPER secretaryRemindDue2: impl loaded OK");
} catch (e) {
  console.error("WRAPPER secretaryRemindDue2: require error", e);
  exports.handler = async () => ({
    statusCode: 500,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ok: false,
      stage: "require(remind-due2-impl)",
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
    console.error("WRAPPER secretaryRemindDue2: impl.handler error", e);
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
