exports.handler = async (event, context) => {
  try {
    const remind = require("./secretary/remind-due.js");
    return await remind.handler(event, context);
  } catch (err) {
    console.log("SECRETARY_REMIND_DUE_WRAPPER_ERROR_MESSAGE:", err && err.message ? err.message : String(err));
    console.log("SECRETARY_REMIND_DUE_WRAPPER_ERROR_STACK:", err && err.stack ? err.stack : "(no stack)");
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        where: "wrapper",
        message: err && err.message ? err.message : String(err)
      })
    };
  }
};
