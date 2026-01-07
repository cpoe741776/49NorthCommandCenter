// netlify/functions/secretaryLoop.js
exports.handler = async (event) => {
  const startedAt = new Date().toISOString();
  console.log("SECRETARY_LOOP_CANARY_START", startedAt);

  try {
    const q = (event && event.queryStringParameters) || {};
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        canary: true,
        startedAt,
        node: process.version,
        query: q
      })
    };
  } catch (err) {
    console.error("SECRETARY_LOOP_CANARY_ERROR", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: String(err?.message || err),
        stack: err?.stack || null
      })
    };
  }
};
