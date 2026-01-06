exports.handler = async (event) => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ok: true,
      source: "secretaryRemindDue2-stub",
      now: new Date().toISOString(),
      echo: {
        path: event && event.path,
        query: event && event.queryStringParameters || null
      }
    })
  };
};
