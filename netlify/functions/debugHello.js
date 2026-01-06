exports.handler = async () => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ok: true,
      source: "debugHello",
      now: new Date().toISOString()
    })
  };
};
