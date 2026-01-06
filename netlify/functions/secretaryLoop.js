exports.handler = async (event) => {
  try {
    const now = new Date().toISOString();
    const query = event && event.queryStringParameters || null;

    console.log("SECRETARY_LOOP_STUB_START", now, query);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        source: "secretaryLoop-stub",
        now,
        query
      })
    };
  } catch (err) {
    console.error("SECRETARY_LOOP_STUB_ERROR", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: String(err && err.message ? err.message : err),
        stack: err && err.stack ? String(err.stack) : null
      })
    };
  }
};
