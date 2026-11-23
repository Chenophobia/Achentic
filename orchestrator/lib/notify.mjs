const BODY_LINES = 8;
const LIMIT = 1800;

function format(title, body) {
  const lines = String(body ?? "").trim().split("\n").slice(0, BODY_LINES).join("\n");
  const text = lines === "" ? `**${title}**` : `**${title}**\n${lines}`;
  return text.length > LIMIT ? `${text.slice(0, LIMIT)}…` : text;
}

export async function notify(config, state, title, body = "") {
  state.log(`${title}${body ? `: ${String(body).split("\n")[0]}` : ""}`);
  if (config.discordUrl === undefined || config.discordUrl === "") return;
  try {
    const response = await fetch(config.discordUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "Achentic", content: format(title, body), allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) state.log(`notify failed: Discord answered ${response.status}`);
  } catch (error) {
    state.log(`notify failed: ${error.message}`);
  }
}
