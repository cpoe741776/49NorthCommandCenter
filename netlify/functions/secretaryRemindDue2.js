exports.handler = async (event) => {
  const now = new Date().toISOString();
  const query = event && event.queryStringParameters
    ? event.queryStringParameters
    : null;

  console.log("SECRETARY_REMINDDUE2_STUB_START", now, query);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ok: true,
      source: "secretaryRemindDue2-stub",
      now,
      query
    })
  };
};
