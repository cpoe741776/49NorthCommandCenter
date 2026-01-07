// netlify/functions/secretaryLoopManual.js
// Manual test wrapper for secretaryLoop (NOT scheduled)

exports.handler = async (event, context) => {
  const mod = require("./secretaryLoop");
  return mod.handler(event, context);
};
