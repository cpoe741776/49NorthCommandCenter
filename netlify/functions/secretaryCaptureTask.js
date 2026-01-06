const capture = require("./secretary/capture-task.js");

exports.handler = async (event, context) => {
  return capture.handler(event, context);
};
