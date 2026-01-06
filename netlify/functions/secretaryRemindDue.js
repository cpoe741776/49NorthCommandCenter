const remind = require("./secretary/remind-due.js");

exports.handler = async (event, context) => {
  return remind.handler(event, context);
};
