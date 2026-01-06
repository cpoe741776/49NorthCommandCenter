exports.handler = async (event, context) => {
  try {
    const remind = require("./secretary/remind-due.js");
    return await remind.handler(event, context);
  } catch (err) {
    console.log("secretaryRemindDue WRAPPER LOAD ERROR:", err && err.stack ? err.stack : err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        where: "wrapper-require",
        error: String((err && err.message) || err)
      })
    };
  }
};
