#!/bin/bash
# Nyaya Setu — Sahayak Live diagnostic. Run from the project folder:  bash scripts/diagnose-sahayak.sh
cd "$(dirname "$0")/.." || exit 1
get() { grep "^$1=" .env | cut -d= -f2- | tr -d '"\r '; }
GK=$(get EXPO_PUBLIC_GEMINI_API_KEY); TK=$(get EXPO_PUBLIC_TINYFISH_API_KEY)
echo "== Keys: Gemini ${#GK} chars, TinyFish ${#TK} chars (0 = missing)"

echo; echo "== 1. Gemini (gemini-3.5-flash-lite)"
curl -s -m 30 -o /tmp/ns_g.json -w "HTTP %{http_code}\n" -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Reply with the word OK"}]}]}' \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=$GK"
grep -o '"message": *"[^"]*"' /tmp/ns_g.json | head -2; grep -o '"text": *"[^"]*"' /tmp/ns_g.json | head -1

echo; echo "== 2. TinyFish Search"
curl -s -m 20 -o /tmp/ns_s.json -w "HTTP %{http_code}\n" -H "X-API-Key: $TK" "https://api.search.tinyfish.ai/?query=pm%20kisan%20eligibility&location=IN&language=en"
head -c 250 /tmp/ns_s.json; echo

echo; echo "== 3. TinyFish Fetch"
curl -s -m 60 -o /tmp/ns_f.json -w "HTTP %{http_code}\n" -X POST -H "X-API-Key: $TK" -H "Content-Type: application/json" \
  -d '{"urls":["https://pmkisan.gov.in/"],"format":"markdown"}' https://api.fetch.tinyfish.ai/
head -c 250 /tmp/ns_f.json; echo

echo; echo "== 4. TinyFish Agent (starts a short run, cancelled after ~90 s — uses a few credits)"
R=$(curl -s -m 30 -w "\n%{http_code}" -X POST -H "X-API-Key: $TK" -H "Content-Type: application/json" \
  -d '{"url":"https://www.myscheme.gov.in/","goal":"Close any pop-up and return JSON {\"title\": page title}","browser_profile":"lite"}' \
  https://agent.tinyfish.ai/v1/automation/run-async)
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | sed '$d'); echo "start HTTP $CODE  $BODY" | head -c 400; echo
ID=$(echo "$BODY" | grep -o '"run_id": *"[^"]*"' | cut -d'"' -f4)
if [ -n "$ID" ]; then
  for i in $(seq 1 30); do
    sleep 3
    S=$(curl -s -m 20 -H "X-API-Key: $TK" "https://agent.tinyfish.ai/v1/runs/$ID?screenshots=none&html=none")
    ST=$(echo "$S" | grep -o '"status": *"[A-Z]*"' | head -1 | cut -d'"' -f4)
    SU=$(echo "$S" | grep -o '"streaming_url": *"[^"]*"' | head -1 | cut -c1-60)
    echo "  t=$((i*3))s status=$ST ${SU:+(live view ready)}"
    [ $i -eq 30 ] && curl -s -m 10 -X POST -H "X-API-Key: $TK" "https://agent.tinyfish.ai/v1/runs/$ID/cancel" >/dev/null && echo "  (cancelled test run)"
    case "$ST" in COMPLETED|FAILED|CANCELLED) echo "$S" | grep -o '"result":.\{0,200\}\|"error":.\{0,250\}'; break;; esac
  done
fi
echo; echo "== Done. Copy everything above and send it to Claude."
