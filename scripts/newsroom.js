#!/usr/bin/env node
// newsroom.js — runs the dreaming.press AI newsroom for one cycle.
//
//   node scripts/newsroom.js cycle [--n 2] [--dry]   full cycle: commission→write→produce→deploy
//   node scripts/newsroom.js brief                    print the engagement-informed brief
//   node scripts/newsroom.js write --role X --section Y [--dry]
//
// Writers are role-conditioned `claude -p` agents. Topic selection is steered by
// LIVE production engagement (what attracts + retains). Designer/audio = the
// generative-cover + neural-TTS pipeline. Editor sets the lead.
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const APP = path.join(REPO, "app");
const CONTENT = path.join(REPO, "content", "posts");
const SITE = "https://dreaming.press";
const CLAUDE = process.env.CLAUDE_BIN || "claude";

const args = process.argv.slice(2);
const cmd = args[0] || "cycle";
const flag = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d; };
const has = (k) => args.includes("--" + k);
const DRY = has("dry");
const today = new Date(Date.now()).toISOString().slice(0, 10);

async function loadRoles() { return import(path.join(APP, "newsroom", "roles.js")); }
async function loadAnalytics() { return import(path.join(APP, "lib", "analytics.js")); }
async function loadData() { return import(path.join(APP, "lib", "data.js")); }

function log(...a) { console.log("▸", ...a); }

// pull LIVE engagement from production; fall back to local report
async function getBrief() {
  const A = await loadAnalytics();
  try {
    const res = await fetch(`${SITE}/api/analytics`, { signal: AbortSignal.timeout(8000) });
    if (res.ok) { const report = await res.json(); return { brief: A.briefText(report), report }; }
  } catch {}
  return { brief: A.brief(), report: null };
}

function existingTitles() {
  if (!fs.existsSync(CONTENT)) return [];
  return fs.readdirSync(CONTENT).filter(f => f.endsWith(".md"))
    .map(f => { const m = /title:\s*(.+)/.exec(fs.readFileSync(path.join(CONTENT, f), "utf8")); return m ? m[1].trim() : f; });
}

function listDrafts() { return new Set(fs.existsSync(CONTENT) ? fs.readdirSync(CONTENT).filter(f => f.endsWith(".md")) : []); }

async function runWriter(role, section, brief, R) {
  const recent = existingTitles().slice(-40).join("; ");
  const prompt = `${R.HOUSE}

${role.prompt}

YOUR ASSIGNMENT: write one piece for the "${section}" desk. Use author id "${role.author}" and date ${today}. Do not set featured.

${brief}

Already published (avoid overlap): ${recent}

${R.FORMAT}`;
  const before = listDrafts();
  log(`${role.name} (${role.title}) → ${section} …`);
  if (process.env.NEWSROOM_FAKE) {            // offline test mode
    const slug = `${role.id}-${section}-${Date.now()}`;
    fs.writeFileSync(path.join(CONTENT, slug + ".md"),
      `---\ntitle: Test ${role.title} Piece\ndek: A placeholder.\nauthor: ${role.author}\nsection: ${section}\ndate: ${today}\ntags: reportive\n---\n\nPlaceholder body for offline testing. ${"word ".repeat(120)}\n`);
  } else {
    try {
      execFileSync(CLAUDE, ["-p", prompt, "--allowedTools", "Write Read Bash WebSearch WebFetch",
        "--permission-mode", "acceptEdits"], { cwd: REPO, stdio: ["ignore", "inherit", "inherit"], timeout: 600000 });
    } catch (e) { log(`  ${role.name} run ended (${e.code || e.message})`); }
  }
  const after = listDrafts();
  const created = [...after].filter(f => !before.has(f));
  if (created.length) { log(`  ✓ filed: ${created[0]}`); return created[0].replace(/\.md$/, ""); }
  log(`  ✗ ${role.name} filed nothing`); return null;
}

function sh(c) { execSync(c, { cwd: REPO, stdio: "inherit" }); }

async function produce(newSlugs) {
  log("Art direction + ingest…");
  sh(`cd app && node scripts/ingest.js && node scripts/gen-art.js`);
  log("Audio desk: narrating new pieces…");
  try {
    sh(`python3 tts/make_manifest.py`);
    sh(`cd tts && . .venv/bin/activate && python3 synth_batch.py`);
  } catch { log("  (narration step skipped)"); }
}

async function setFeatured(slug) {
  // editor leads with this piece; newest featured wins on the homepage
  const f = path.join(CONTENT, slug + ".md");
  if (!fs.existsSync(f)) return;
  let s = fs.readFileSync(f, "utf8");
  if (!/^featured:/m.test(s)) s = s.replace(/^---\n/, "---\nfeatured: true\n");
  fs.writeFileSync(f, s);
}

async function cycle() {
  const R = await loadRoles();
  const n = Math.max(1, Math.min(4, parseInt(flag("n", "2"), 10)));
  const { brief } = await getBrief();
  log("Editor-in-chief reviewing the numbers and commissioning the slate…");
  console.log(brief.split("\n").map(l => "   " + l).join("\n"));

  // assignments: rotate through the desk so coverage stays balanced
  const startIdx = Math.floor(Date.now() / 36e5); // hour-based rotation seed
  const slugs = [];
  for (let i = 0; i < n; i++) {
    const [roleId, section] = R.rotationFor(startIdx + i);
    const role = R.ROLES[roleId];
    const slug = await runWriter(role, section, brief, R);
    if (slug) slugs.push(slug);
  }
  if (!slugs.length) { log("No pieces filed — aborting cycle."); process.exit(1); }

  await setFeatured(slugs[0]);          // the lead
  await produce(slugs);

  if (DRY) { log("--dry: built, not deployed."); return; }
  log("Deploying…");
  sh(`bash scripts/deploy-app.sh`);
  log("Committing…");
  try {
    // explicit refspec, not bare `git push`: the runner's git proxy has
    // intermittently rejected push.default=simple as a false "non-fast-forward"
    // on a provably-clean fast-forward (see ENHANCEMENTS), and HEAD:refs/heads/main
    // resolves it — so the publish path never silently fails to ship (#17 cadence).
    sh(`git add -A && git commit -q -m "Newsroom cycle: ${slugs.join(", ")}" && git push -q origin HEAD:refs/heads/main`);
  } catch { log("  (commit/push skipped)"); }
  log(`✓ Newsroom cycle complete: ${slugs.length} new pieces, lead: ${slugs[0]}`);
}

async function main() {
  if (cmd === "brief") { console.log((await getBrief()).brief); return; }
  if (cmd === "write") {
    const R = await loadRoles();
    const role = R.ROLES[flag("role", "technology-journalist")];
    const section = flag("section", role.sections?.[0] || "wire");
    const { brief } = await getBrief();
    const slug = await runWriter(role, section, brief, R);
    if (slug && !DRY) { await produce([slug]); sh(`bash scripts/deploy-app.sh`); }
    return;
  }
  return cycle();
}
main().catch(e => { console.error(e); process.exit(1); });
