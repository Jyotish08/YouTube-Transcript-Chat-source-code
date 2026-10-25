#!/bin/bash
set -euo pipefail

SUPABASE_URL="${SUPABASE_URL:-https://kczhvclsdjdkmxpnawib.supabase.co}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-sb_publishable_ZuXO-a7ilo4XwydgX-262g_SulIrCO7}"

TEST_URL="${1:-https://www.youtube.com/watch?v=x9Ra9KmEkGQ}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

echo -e "${YELLOW}══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  TRANSCRIPTION TEST${NC}"
echo -e "${YELLOW}══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  URL:        ${CYAN}${TEST_URL}${NC}"
echo -e "  SUPABASE:   ${CYAN}${SUPABASE_URL}${NC}"
echo ""

echo -e "${YELLOW}[1/5] Submitting video for processing...${NC}"
RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/process-video-v2" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -d "{\"youtube_url\": \"${TEST_URL}\"}")

VIDEO_ID=$(echo "$RESPONSE" | jq -r '.video_id // empty')
ERROR=$(echo "$RESPONSE" | jq -r '.error // empty')

if [[ -z "$VIDEO_ID" ]]; then
  echo -e "  ${RED}✗ Failed to submit:${NC} ${ERROR:-$(echo "$RESPONSE" | head -c 300)}"
  exit 1
fi
echo -e "  ${GREEN}✓ Video ID:${NC} ${VIDEO_ID}"
echo ""

echo -e "${YELLOW}[2/5] Polling status (timeout: 10 min)...${NC}"
max_polls=120
poll_interval=10
last_status=""
start_time=$(date +%s)

for ((i=1; i<=max_polls; i++)); do
  elapsed=$(( $(date +%s) - start_time ))
  mins=$(( elapsed / 60 ))
  secs=$(( elapsed % 60 ))
  timestamp=$(printf "%02d:%02d" $mins $secs)

  RESULT=$(curl -s "${SUPABASE_URL}/rest/v1/videos?id=eq.${VIDEO_ID}&select=id,status,title,error_message" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "apikey: ${SUPABASE_ANON_KEY}" 2>/dev/null)

  STATUS=$(echo "$RESULT" | jq -r '.[0].status // empty' 2>/dev/null)
  TITLE=$(echo "$RESULT" | jq -r '.[0].title // empty' 2>/dev/null)
  ERROR_MSG=$(echo "$RESULT" | jq -r '.[0].error_message // empty' 2>/dev/null)

  if [[ "$STATUS" != "$last_status" ]]; then
    echo -e "  [${timestamp}] Status → ${CYAN}${STATUS}${NC}"
    last_status=$STATUS
  fi

  if (( i % 6 == 0 )) && [[ "$STATUS" != "done" && "$STATUS" != "error" ]]; then
    echo -e "  [${timestamp}] Still processing... (status=${STATUS})"
  fi

  if [[ "$STATUS" == "done" ]]; then
    echo -e "  ${GREEN}✓ Done in ${elapsed}s${NC}"
    echo -e "  Title: ${CYAN}${TITLE:-N/A}${NC}"
    break
  fi

  if [[ "$STATUS" == "error" ]]; then
    echo -e "  ${RED}✗ ERROR${NC}"
    echo -e "  Error msg: ${RED}${ERROR_MSG:-Unknown}${NC}"
    break
  fi

  if [[ -z "$STATUS" || "$STATUS" == "null" ]]; then
    echo -e "  ${RED}✗ Could not read status${NC}"
    echo "  Response: $(echo "$RESULT" | head -c 400)"
    break
  fi

  sleep $poll_interval
done

if [[ "$STATUS" != "done" && "$STATUS" != "error" ]]; then
  echo -e "  ${RED}✗ Timed out after ${elapsed}s. Last status: ${STATUS:-unknown}${NC}"
fi
echo ""

echo -e "${YELLOW}[3/5] Checking transcripts...${NC}"
TRANSCRIPTS=$(curl -s "${SUPABASE_URL}/rest/v1/transcripts?video_id=eq.${VIDEO_ID}&select=id,chunk_index,status,content,error_message" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" 2>/dev/null)

TOTAL=$(echo "$TRANSCRIPTS" | jq -r 'length // 0' 2>/dev/null)
DONE=$(echo "$TRANSCRIPTS" | jq -r 'map(select(.status == "done")) | length' 2>/dev/null)
ERROR_COUNT=$(echo "$TRANSCRIPTS" | jq -r 'map(select(.status == "error")) | length' 2>/dev/null)

echo -e "  Total chunks:  ${TOTAL}"
if [[ "$TOTAL" -gt 0 ]]; then
  echo -e "  Done:          ${GREEN}${DONE}${NC}"
  echo -e "  Errors:        ${RED}${ERROR_COUNT}${NC}"
  FIRST_CONTENT=$(echo "$TRANSCRIPTS" | jq -r '.[0].content // empty' 2>/dev/null)
  if [[ -n "$FIRST_CONTENT" ]]; then
    echo ""
    echo -e "  Preview:"
    echo -e "  ${CYAN}${FIRST_CONTENT:0:200}...${NC}"
    echo ""
  fi
  if [[ "$ERROR_COUNT" -gt 0 ]]; then
    echo -e "  ${RED}Transcript errors:${NC}"
    echo "$TRANSCRIPTS" | jq -r '.[] | select(.status == "error") | "    chunk \(.chunk_index): \(.error_message)"'
  fi
fi
echo ""

echo -e "${YELLOW}[4/5] Checking audio storage...${NC}"
STORAGE=$(curl -s "${SUPABASE_URL}/storage/v1/object/list/audio-chunks" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" 2>/dev/null)
STORAGE_MATCH=$(echo "$STORAGE" | jq -r "map(select(.name | startswith(\"${VIDEO_ID}/\"))) | length" 2>/dev/null)
echo -e "  Files: ${STORAGE_MATCH:-0}"
echo ""

echo -e "${YELLOW}[5/5] Summary${NC}"
echo ""
if [[ "$STATUS" == "done" && "$TOTAL" -gt 0 && "$DONE" -gt 0 ]]; then
  echo -e "  ${GREEN}✅ TRANSCRIPTION SUCCESSFUL${NC}"
  exit 0
elif [[ "$STATUS" == "error" ]]; then
  echo -e "  ${RED}❌ FAILED${NC}"
  echo ""
  echo -e "  Check edge function logs via:"
  echo -e "    ${CYAN}get_logs(project_id='kczhvclsdjdkmxpnawib', service='edge-function')${NC}"
  echo ""
  exit 1
else
  echo -e "  ${YELLOW}⚠ INCOMPLETE${NC}"
  exit 1
fi