// netlify/functions/secretaryLoopManual.js
// Manual HTTP wrapper around the scheduled secretaryLoop
// so you can trigger a run on-demand via browser/curl.

const { handler } = require("./secretaryLoop");

exports.handler = handler;
