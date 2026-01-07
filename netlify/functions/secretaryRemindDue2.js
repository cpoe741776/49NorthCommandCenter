// netlify/functions/secretaryRemindDue2.js
const impl = require("./secretary/remind-due2-impl.js");

exports.handler = async (event, context) => {
  return impl.handler(event, context);
};
