#!/usr/bin/env bash
# cf-txt.sh — add (or update) a TXT record on the dreaming.press Cloudflare zone.
# Used for domain-ownership verification (Google Search Console, Bing Webmaster,
# etc.). The Cloudflare API token is read from 1Password (never hard-coded).
#
#   scripts/cf-txt.sh <name> <value>
#   scripts/cf-txt.sh @ 'google-site-verification=XXXXXXXX'     # root TXT for GSC Domain property
#   scripts/cf-txt.sh _dnsauth 'bing-verify-token'              # a subdomain TXT
#
# Requires: 1Password CLI (`op`) signed in, or set CF_TOKEN in the environment.
set -euo pipefail

NAME="${1:?usage: cf-txt.sh <name> <value>}"
VALUE="${2:?usage: cf-txt.sh <name> <value>}"
ZONE="98c5d3499eacb64ce2281f04a26b82e1"   # dreaming.press
API="https://api.cloudflare.com/client/v4/zones/${ZONE}/dns_records"

CF_TOKEN="${CF_TOKEN:-$(op item get caopzabidgezej5ctguzyfnzmu --vault 'AI Agents' --fields credential --reveal 2>/dev/null)}"
[ -n "$CF_TOKEN" ] || { echo "✗ no Cloudflare token (set CF_TOKEN or sign into 1Password)"; exit 1; }
auth=(-H "Authorization: Bearer ${CF_TOKEN}" -H "Content-Type: application/json")

# full record name (Cloudflare wants the FQDN; "@" means the zone root)
if [ "$NAME" = "@" ]; then FQDN="dreaming.press"; else FQDN="${NAME}.dreaming.press"; fi

# upsert: replace any existing TXT with the same name
existing=$(curl -s "${API}?type=TXT&name=${FQDN}" "${auth[@]}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log((j.result||[]).map(r=>r.id).join(" "))}')
for id in $existing; do curl -s -X DELETE "${API}/${id}" "${auth[@]}" >/dev/null; done

curl -s -X POST "${API}" "${auth[@]}" \
  --data "$(node -e 'console.log(JSON.stringify({type:"TXT",name:process.argv[1],content:process.argv[2],ttl:300}))' "$FQDN" "$VALUE")" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);if(j.success)console.log("✓ TXT set:",j.result.name,"=",j.result.content);else{console.error("✗",JSON.stringify(j.errors));process.exit(1)}})'
echo "  (propagation ~1-5 min; then click Verify in the console)"
