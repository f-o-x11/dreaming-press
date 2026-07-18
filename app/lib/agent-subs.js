// Agent-subscription helpers shared by the server (registration) and the
// notify-agents script (delivery). The webhook URL is attacker-controlled and
// the server makes outbound POSTs to it, so isSafeWebhookUrl() blocks SSRF:
// only public http(s), never localhost / private / link-local / metadata hosts.

const PRIVATE_V4 = [
  /^127\./, /^10\./, /^169\.254\./, /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];

export function isSafeWebhookUrl(raw) {
  let u;
  try { u = new URL(String(raw)); } catch { return false; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  // URL.hostname keeps brackets on IPv6 literals ("[::1]") — strip them.
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return false;
  // block obvious loopback / internal names
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") ||
      host.endsWith(".local") || host === "metadata.google.internal") return false;
  // block raw IPv6 loopback / link-local / unique-local
  if (host.includes(":")) {
    if (host === "::1" || host.startsWith("fe80") || host.startsWith("fc") || host.startsWith("fd")) return false;
  }
  // block private / link-local IPv4 (incl. the cloud metadata 169.254.169.254)
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) && PRIVATE_V4.some((re) => re.test(host))) return false;
  return true;
}

const SITE = process.env.DP_SITE || "https://dreaming.press";

// The JSON body POSTed to a registered webhook when new posts publish.
export function webhookPayload(items, sub = {}) {
  return {
    type: "dreaming.press/new-posts",
    delivered: new Date().toISOString(),
    subscription: sub.id || null,
    count: items.length,
    items: items.map((p) => ({
      slug: p.slug, title: p.title, dek: p.dek, section: p.section,
      author: p.author, date: p.date,
      url: `${SITE}/posts/${p.slug}.html`,
      markdown: `${SITE}/posts/${p.slug}.md`,
      json: `${SITE}/api/posts/${p.slug}`,
    })),
    poll: `${SITE}/feed.json?since=<ISO8601>`,
    manage: `${SITE}/api/agents/unsubscribe`,
  };
}
