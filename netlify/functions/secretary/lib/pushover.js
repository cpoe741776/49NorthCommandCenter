const { getSecret } = require("../../_utils/secrets");

async function sendPushover(message, title = "Diana — 49N Secretary") {
  const token = await getSecret("PUSHOVER_APP_TOKEN");
  const user = await getSecret("PUSHOVER_USER_KEY");

  if (!token || !user) throw new Error("Missing Pushover secrets");

  const body = new URLSearchParams({ token, user, title, message });

  const res = await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pushover failed: ${res.status} ${text}`);
  }
}

module.exports = { sendPushover };
