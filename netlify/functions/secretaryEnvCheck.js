exports.handler = async () => {
  const has = (k) => {
    const v = process.env[k];
    return v ? `set(${v.length})` : "MISSING";
  };

  const report = {
    PUSHOVER_APP_TOKEN: has("PUSHOVER_APP_TOKEN"),
    PUSHOVER_USER_KEY: has("PUSHOVER_USER_KEY"),
    SECRETARY_TASKS_SHEET_ID: has("SECRETARY_TASKS_SHEET_ID"),
    GOOGLE_CLIENT_EMAIL: has("GOOGLE_CLIENT_EMAIL"),
    GOOGLE_PRIVATE_KEY: has("GOOGLE_PRIVATE_KEY"),
    CONTEXT: process.env.CONTEXT || "unknown",
    DEPLOY_CONTEXT: process.env.DEPLOY_CONTEXT || "unknown",
    NODE_VERSION: process.version
  };

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report, null, 2)
  };
};
