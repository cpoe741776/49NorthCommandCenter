const impl = require("./secretaryRemindDue2");

exports.handler = async (event, context) => {
  const res = await impl.handler(event, context);
  // Tag the response so we know we went through the proxy
  return {
    ...res,
    headers: {
      ...(res.headers || {}),
      "x-secretary-debug-proxy": "1"
    }
  };
};
