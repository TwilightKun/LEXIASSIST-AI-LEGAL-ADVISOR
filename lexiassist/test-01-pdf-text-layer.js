// test-01-pdf-text-layer.js
//
// WHAT THIS TESTS: parse-pdf's native text-layer extraction path (unpdf),
// end to end into the loop, confirming a Document row gets created and
// linked to the CaseBrief.
//
// WHAT SUCCESS LOOKS LIKE:
//   - Session status ends as COMPLETED (not FAILED)
//   - caseBrief.documents has exactly 1 entry
//   - extractedTextLength > 0
//   - Server console shows NO "[PARSE-PDF] ... falling back to vision OCR"
//     line — if you see that line, your test PDF actually has no real text
//     layer and you should swap it for a genuinely text-based PDF.

import { CONFIG, createCase, initSession, pollSessionUntilDone, printSection } from './test-config.js';

async function run() {
  printSection('TEST 01: PDF Text-Layer Extraction');

  if (CONFIG.TEXT_LAYER_PDF_URL.includes('PASTE_')) {
    console.error('\x1b[31m✗ Set TEXT_LAYER_PDF_URL in test-config.js first.\x1b[0m');
    process.exit(1);
  }

  const caseBriefId = await createCase('Test Case — Text Layer PDF');

  const sessionId = await initSession({
    prompt: 'Here is a copy of my lease agreement. Please review it as part of my case.',
    caseBriefId,
    fileUrl: `${CONFIG.SCANNED_PDF_URL}?t=${Date.now()}`,
    hasPdf: true,
  });

  console.log('\n[POLLING] Waiting for parse-pdf -> loop to complete (this may take 10-30s)...');
  const result = await pollSessionUntilDone(sessionId, { timeoutMs: 90000 });

  console.log('\n--- FINAL SESSION STATE ---');
  console.log(JSON.stringify(result, null, 2));

  // Assertions
  const failures = [];
  if (result.status !== 'COMPLETED') failures.push(`Expected status COMPLETED, got ${result.status}`);
  if (!result.caseBrief) failures.push('No caseBrief attached to session');
  if (result.caseBrief && result.caseBrief.documents.length !== 1) {
    failures.push(`Expected exactly 1 document, got ${result.caseBrief.documents.length}`);
  }
  if (result.caseBrief?.documents[0]?.extractedTextLength === 0) {
    failures.push('Document extractedText is empty — extraction likely failed silently');
  }

  if (failures.length) {
    console.error('\n\x1b[31m✗ TEST FAILED:\x1b[0m');
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }

  console.log('\n\x1b[32m✓ TEST 01 PASSED\x1b[0m');
  console.log(`  Document ID: ${result.caseBrief.documents[0].id}`);
  console.log(`  Extracted ${result.caseBrief.documents[0].extractedTextLength} chars`);
  console.log(`  Preview: "${result.caseBrief.documents[0].extractedTextPreview}..."`);
}

run().catch((e) => {
  console.error('\x1b[31m✗ CRITICAL ERROR:\x1b[0m', e.message);
  process.exit(1);
});