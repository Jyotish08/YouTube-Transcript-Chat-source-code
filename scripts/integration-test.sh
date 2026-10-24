#!/bin/bash
# =============================================================================
# Integration Test for YouTube Transcript Chat
# =============================================================================
# Tests the full video processing pipeline end-to-end.
# 1. Submits a YouTube URL to process-video Edge Function
# 2. Polls the database for status changes (pending → downloading → transcribing → done)
# 3. Verifies transcripts + embeddings are generated
# 4. Tests the chat-agent with a question about the transcript
#
# Usage: bash scripts/integration-test.sh
# =============================================================================

set -euo pipefail

# Configuration
SUPABASE_URL="https://tpiohvdmwkqndgifwngg.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwaW9odmRtd2txbmRnaWZ3bmdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3Nzg2NTUsImV4cCI6MjEwMTM1NDY1NX0.tRPmCo1NTnoQfyuiBC5k-RW86pGlKfviYI28DfloKOM"

TEST_VIDEO_URL="https://www.youtube.com/watch?v=x9Ra9KmEkGQ"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

pass_count=0
fail_count=0

pass() {
  ((pass_count++))
  echo -e "  ${GREEN}✓ PASS:${NC} $1"
}

fail() {
  ((fail_count++))
  echo -e "  ${RED}✗ FAIL:${NC} $1"
}

info() {
  echo -e "${CYAN}  →${NC} $1"
}

header() {
  echo ""
  echo -e "${YELLOW}══════════════════════════════════════════════════════════════${NC}"
  echo -e "${YELLOW}  $1${NC}"
  echo -e "${YELLOW}══════════════════════════════════════════════════════════════${NC}"
  echo ""
}

# =============================================================================
# Test 1: Submit video for processing
# =============================================================================
header "Test 1: Submit video URL to process-video function"

RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/process-video-v2" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -d "{\"youtube_url\": \"${TEST_VIDEO_URL}\"}")

echo "  Response: ${RESPONSE}"

VIDEO_ID=$(echo "$RESPONSE" | jq -r '.video_id // empty' 2>/dev/null)

if [[ -n "$VIDEO_ID" && "$VIDEO_ID" != "null" ]]; then
  pass "Got video_id: ${VIDEO_ID}"
else
  fail "Failed to get video_id from response"
  exit 1
fi

# =============================================================================
# Test 2: Poll for status progression
# =============================================================================
header "Test 2: Poll database for video status"

max_polls=120
poll_interval=10
last_status="pending"
start_time=$(date +%s)

for ((i=1; i<=max_polls; i++)); do
  elapsed=$(( $(date +%s) - start_time ))
  
  RESULT=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/get_video_status" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -d "{\"video_id_param\": \"${VIDEO_ID}\"}" 2>/dev/null || \
    curl -s "${SUPABASE_URL}/rest/v1/videos?id=eq.${VIDEO_ID}&select=id,status,title,error_message" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      -H "apikey: ${SUPABASE_ANON_KEY}")

  STATUS=$(echo "$RESULT" | jq -r 'if type == "array" then .[0].status else .status end // empty' 2>/dev/null)
  TITLE=$(echo "$RESULT" | jq -r 'if type == "array" then .[0].title else .title end // empty' 2>/dev/null)
  ERROR_MSG=$(echo "$RESULT" | jq -r 'if type == "array" then .[0].error_message else .error_message end // empty' 2>/dev/null)

  if [[ "$STATUS" != "$last_status" ]]; then
    echo -e "  ${CYAN}[${elapsed}s]${NC} Status changed: ${last_status} → ${STATUS}"
    last_status=$STATUS
  fi

  if [[ "$STATUS" == "done" ]]; then
    pass "Video processing completed successfully in ${elapsed}s"
    info "Title: ${TITLE:-N/A}"
    break
  fi

  if [[ "$STATUS" == "error" ]]; then
    fail "Video processing failed with error: ${ERROR_MSG:-Unknown error}"
    echo "  Full response: ${RESULT}"
    break
  fi

  if [[ "$STATUS" == "null" || -z "$STATUS" ]]; then
    fail "Could not read status from response"
    echo "  Response: ${RESULT}"
    break
  fi

  if (( i % 6 == 0 )); then
    info "Still processing... status: ${STATUS} (${elapsed}s elapsed)"
  fi

  sleep $poll_interval
done

if [[ "$STATUS" != "done" && "$STATUS" != "error" ]]; then
  fail "Timed out after ${max_polls} polls (${max_polls} × ${poll_interval}s). Last status: ${STATUS:-unknown}"
fi

# =============================================================================
# Test 3: Verify transcripts exist
# =============================================================================
header "Test 3: Verify transcripts generated"

TRANSCRIPT_COUNT=$(curl -s "${SUPABASE_URL}/rest/v1/transcripts?video_id=eq.${VIDEO_ID}&select=count" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Accept: application/json" | jq -r 'length // 0' 2>/dev/null)

if [[ "$TRANSCRIPT_COUNT" -gt 0 ]]; then
  pass "Found ${TRANSCRIPT_COUNT} transcript chunks"
else
  fail "No transcript chunks found for video ${VIDEO_ID}"
fi

# =============================================================================
# Test 4: Verify embeddings exist
# =============================================================================
header "Test 4: Verify embeddings generated"

EMBEDDED_COUNT=$(curl -s "${SUPABASE_URL}/rest/v1/transcripts?video_id=eq.${VIDEO_ID}&select=id&status=eq.done" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Accept: application/json" | jq -r 'length // 0' 2>/dev/null)

if [[ "$EMBEDDED_COUNT" -gt 0 ]]; then
  pass "${EMBEDDED_COUNT}/${TRANSCRIPT_COUNT} chunks have embeddings (status=done)"
else
  fail "No chunks with embeddings found"
fi

# =============================================================================
# Test 5: Verify storage has audio file
# =============================================================================
header "Test 5: Verify audio stored"

STORAGE_FILES=$(curl -s "${SUPABASE_URL}/storage/v1/object/list/audio-chunks" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json")

if echo "$STORAGE_FILES" | jq -e ".[] | select(.name | startswith(\"${VIDEO_ID}/\"" > /dev/null 2>&1; then
  pass "Audio file found in storage for video ${VIDEO_ID}"
else
  fail "No audio file found in storage for video ${VIDEO_ID}"
  info "Storage contents: $(echo $STORAGE_FILES | jq -r '.[].name' 2>/dev/null || echo 'empty')"
fi

# =============================================================================
# Test 6: Test chat-agent with a question
# =============================================================================
if [[ "$STATUS" == "done" && "$EMBEDDED_COUNT" -gt 0 ]]; then
  header "Test 6: Chat agent — ask a question about the video"

  CHAT_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/chat-agent" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -d "{
      \"message\": \"What is this video about? Summarize the key points.\",
      \"video_id\": \"${VIDEO_ID}\"
    }")

  CHAT_STATUS=$(echo "$CHAT_RESPONSE" | jq -r '.status // empty')
  CHAT_ANSWER=$(echo "$CHAT_RESPONSE" | jq -r '.answer // .response // .error // empty')

  if [[ "$CHAT_STATUS" == "success" || -n "$CHAT_ANSWER" ]]; then
    pass "Chat agent responded successfully"
    echo ""
    echo -e "${CYAN}  Chat Agent Response:${NC}"
    echo "${CHAT_ANSWER}" | head -5
    echo ""
  else
    fail "Chat agent returned error: ${CHAT_ANSWER:-empty response}"
    info "Full response: ${CHAT_RESPONSE}"
  fi
fi

# =============================================================================
# Summary
# =============================================================================
header "Test Summary"

total=$((pass_count + fail_count))
echo -e "  ${GREEN}Passed:${NC} ${pass_count}/${total}"
echo -e "  ${RED}Failed:${NC} ${fail_count}/${total}"
echo ""

if [[ "$fail_count" -eq 0 ]]; then
  echo -e "  ${GREEN}✅ ALL TESTS PASSED${NC}"
else
  echo -e "  ${RED}❌ SOME TESTS FAILED${NC}"
  exit 1
fi