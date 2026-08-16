const { requireAuth } = require('./_utils/auth');
const target = require('./getSystemAdminEmails');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') return target.handler(event, context);

  const auth = await requireAuth(event, context);
  if (!auth.ok) return auth.response;

  return target.handler(event, context);
};
