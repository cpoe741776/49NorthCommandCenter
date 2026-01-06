exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ok: true,
      source: "minimal-stub",
      now: new Date().toISOString(),
      echo: {
        path: event.path,
        queryStringParameters: event.queryStringParameters || null
      }
    })
  };
};
