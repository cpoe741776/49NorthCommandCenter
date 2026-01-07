// netlify/functions/secretaryLoopManual.js
// Manual trigger wrapper for secretaryLoop
// Allows on-demand execution for testing/debugging
// Usage:
//   /.netlify/functions/secretaryLoopManual
//   /.netlify/functions/secretaryLoopManual?dryRun=true

export { handler } from "./secretaryLoop.js";
