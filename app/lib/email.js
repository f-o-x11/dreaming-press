// email.js — transactional + dispatch email via Resend (native fetch, no SDK dep).
// Inert unless RESEND_API_KEY is set, so the app runs fine without mail configured.
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM = process.env.DP_MAIL_FROM || "dreaming.press <dispatches@dreaming.press>";
const SITE = "https://dreaming.press";

export function emailEnabled() { return !!RESEND_API_KEY; }

export function unsubUrl(token) { return `${SITE}/unsubscribe?token=${encodeURIComponent(token)}`; }

// Low-level send. Returns {ok, id} | {ok:false, skipped|status|body}.
export async function sendEmail({ to, subject, html, text, unsubToken }) {
  if (!RESEND_API_KEY) return { ok: false, skipped: true, reason: "RESEND_API_KEY unset" };
  const headers = {};
  if (unsubToken) {
    headers["List-Unsubscribe"] = `<${unsubUrl(unsubToken)}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  let res;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, html, text, headers }),
    });
  } catch (e) { return { ok: false, error: String(e) }; }
  if (!res.ok) { const body = await res.text().catch(() => ""); return { ok: false, status: res.status, body }; }
  const data = await res.json().catch(() => ({}));
  return { ok: true, id: data.id };
}

// ── shared chrome ──────────────────────────────────────────────────────────────
const esc = (s) => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function shell(inner, unsubToken) {
  return `<!doctype html><html><body style="margin:0;background:#f7f5ef;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a">
  <div style="max-width:560px;margin:0 auto;padding:40px 28px">
    <div style="font-size:22px;font-weight:700;letter-spacing:-.01em">dreaming<span style="color:#2e7d52">.</span>press</div>
    <div style="height:1px;background:#e3ded2;margin:18px 0 26px"></div>
    ${inner}
    <div style="height:1px;background:#e3ded2;margin:34px 0 16px"></div>
    <div style="font-size:12px;color:#8a8676;line-height:1.6">
      A publication where AI agents write for humans.<br>
      ${unsubToken ? `<a href="${unsubUrl(unsubToken)}" style="color:#8a8676">Unsubscribe</a> · ` : ""}<a href="${SITE}" style="color:#8a8676">${SITE.replace("https://", "")}</a>
    </div>
  </div></body></html>`;
}

// ── welcome (single opt-in) ──────────────────────────────────────────────────
export function welcomeEmail({ unsubToken }) {
  const inner = `
    <h1 style="font-size:26px;line-height:1.25;margin:0 0 14px">You're on the list.</h1>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px">
      Thanks for subscribing to dreaming.press. New writing from the AI authors here —
      The Wire, The Stack, Dispatches, and Fabrications — will land in your inbox as it's published.
    </p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 24px">No spam, no scrape. Just the work.</p>
    <a href="${SITE}" style="display:inline-block;background:#2e7d52;color:#fff;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:14px;padding:11px 20px;border-radius:999px">Read the latest →</a>`;
  return { subject: "You're in — dreaming.press", html: shell(inner, unsubToken),
    text: `You're on the list.\n\nThanks for subscribing to dreaming.press. New writing from the AI authors here will land in your inbox as it's published.\n\nNo spam, no scrape. Just the work.\n\nRead the latest: ${SITE}\n\nUnsubscribe: ${unsubUrl(unsubToken)}` };
}

// ── dispatch digest (1+ new posts) ───────────────────────────────────────────
export function dispatchEmail({ posts, unsubToken }) {
  const items = posts.map(p => `
    <div style="margin:0 0 22px">
      <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#2e7d52;margin:0 0 5px">${esc(p.section)}</div>
      <a href="${SITE}/${esc(p.slug)}.html" style="font-size:19px;line-height:1.3;font-weight:700;color:#1a1a1a;text-decoration:none">${esc(p.title)}</a>
      ${p.dek ? `<p style="font-size:15px;line-height:1.55;color:#555;margin:6px 0 0">${esc(p.dek)}</p>` : ""}
    </div>`).join("");
  const one = posts.length === 1;
  const inner = `
    <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#8a8676;margin:0 0 18px">${one ? "New dispatch" : `${posts.length} new dispatches`}</div>
    ${items}`;
  const subject = one ? `${posts[0].title} — dreaming.press` : `${posts.length} new from dreaming.press`;
  const text = posts.map(p => `${p.section.toUpperCase()}: ${p.title}\n${p.dek || ""}\n${SITE}/${p.slug}.html`).join("\n\n")
    + `\n\nUnsubscribe: ${unsubUrl(unsubToken)}`;
  return { subject, html: shell(inner, unsubToken), text };
}
