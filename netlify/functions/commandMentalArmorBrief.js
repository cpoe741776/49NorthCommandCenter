const { requireAuth } = require('./_utils/auth');
const getDashboardData = require('./getDashboardData');
const getBids = require('./getBids');
const getReminders = require('./getReminders');
const getSystemAdminEmails = require('./getSystemAdminEmails');

function parseBody(result) {
  if (!result) return null;
  if (typeof result.body === 'object') return result.body;
  try { return JSON.parse(result.body || 'null'); } catch { return null; }
}

function normalizeRecommendation(value) {
  return String(value || '').trim().toLowerCase();
}

function daysUntil(dateValue) {
  if (!dateValue) return null;
  const t = Date.parse(dateValue);
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - Date.now()) / 86400000);
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Token',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  const auth = await requireAuth(event, context);
  if (!auth.ok) return { ...auth.response, headers: { ...headers, ...(auth.response.headers || {}) } };

  const readEvent = { ...event, httpMethod: 'GET', queryStringParameters: {} };
  const remindersEvent = {
    ...readEvent,
    queryStringParameters: { includeExecutiveTasks: '1' },
  };

  const settled = await Promise.allSettled([
    getDashboardData.handler(readEvent, context),
    getBids.handler(readEvent, context),
    getReminders.handler(remindersEvent, context),
    getSystemAdminEmails.handler(readEvent, context),
  ]);

  const [dashboardResult, bidsResult, remindersResult, adminResult] = settled.map((r) =>
    r.status === 'fulfilled' ? r.value : null
  );

  const dashboard = parseBody(dashboardResult) || {};
  const bidPayload = parseBody(bidsResult) || {};
  const reminderPayload = parseBody(remindersResult) || {};
  const adminPayload = parseBody(adminResult) || {};

  const activeBids = Array.isArray(bidPayload.activeBids) ? bidPayload.activeBids : [];
  const submittedBids = Array.isArray(bidPayload.submittedBids) ? bidPayload.submittedBids : [];
  const disregardedBids = Array.isArray(bidPayload.disregardedBids) ? bidPayload.disregardedBids : [];

  const respond = activeBids.filter((b) => normalizeRecommendation(b.recommendation) === 'respond');
  const gatherMoreInfo = activeBids.filter((b) => normalizeRecommendation(b.recommendation) === 'gather more information');

  const dueSoon = activeBids
    .map((b) => ({
      id: b.id || b.sourceEmailId || null,
      subject: b.emailSubject || b.subject || '',
      entity: b.entity || b.agency || '',
      dueDate: b.dueDate || '',
      recommendation: b.recommendation || '',
      daysUntilDue: daysUntil(b.dueDate),
    }))
    .filter((b) => b.daysUntilDue !== null && b.daysUntilDue >= 0 && b.daysUntilDue <= 7)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
    .slice(0, 10);

  const executiveTasks = Array.isArray(reminderPayload.executiveTasks)
    ? reminderPayload.executiveTasks
    : [];
  const openTasks = executiveTasks.filter((r) => String(r.status || 'open').toLowerCase() === 'open');
  const adminEmails = Array.isArray(adminPayload.emails) ? adminPayload.emails : [];

  const failures = [];
  const labels = ['dashboard', 'bids', 'reminders', 'systemAdminEmails'];
  settled.forEach((r, index) => {
    if (r.status === 'rejected') failures.push({ source: labels[index], error: r.reason?.message || String(r.reason) });
    else if (r.value && Number(r.value.statusCode) >= 400) failures.push({ source: labels[index], statusCode: r.value.statusCode });
  });

  return {
    statusCode: failures.length === labels.length ? 503 : 200,
    headers,
    body: JSON.stringify({
      success: failures.length !== labels.length,
      generatedAt: new Date().toISOString(),
      mission: 'Mental Armor',
      dashboard: dashboard.summary || dashboard,
      bids: {
        active: activeBids.length,
        respond: respond.length,
        gatherMoreInformation: gatherMoreInfo.length,
        submitted: submittedBids.length,
        disregarded: disregardedBids.length,
        dueSoon,
      },
      reminders: {
        operationalSummary: reminderPayload.summary || {},
        weekly: reminderPayload.weeklyReminders || {},
        webinar: Array.isArray(reminderPayload.webinarReminders) ? reminderPayload.webinarReminders : [],
        executiveTasks: {
          total: executiveTasks.length,
          open: openTasks.length,
          items: openTasks.slice(0, 10),
        },
        executiveTasksError: reminderPayload.executiveTasksError || null,
      },
      systemAdmin: {
        total: adminEmails.length,
        new: Number.isFinite(Number(adminPayload.newCount)) ? Number(adminPayload.newCount) : adminEmails.filter((e) => String(e.status || 'New').toLowerCase() === 'new').length,
      },
      sourceFailures: failures,
    }),
  };
};
