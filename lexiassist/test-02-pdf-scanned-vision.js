// test-02-pdf-scanned-vision.js
//
// WHAT THIS TESTS: parse-pdf's vision-OCR fallback path — triggers when
// unpdf's text-layer extraction returns < 50 chars, which should be the
// case for an image-only/scanned PDF.
//
// WHAT SUCCESS LOOKS LIKE:
//   - Server console DOES show "[PARSE-PDF] ... falling back to vision OCR"
//     (if it doesn't, your "scanned" PDF actually has a real text layer —
//     swap the fixture)
//   - Session status ends COMPLETED
//   - extractedTextLength > 0 (Gemini successfully transcribed the image)
//   - This test takes noticeably longer than test-01 since it involves a
//     real Gemini call just for extraction, on top of the orchestration
//     loop's own calls afterward

import { CONFIG, createCase, initSession, pollSessionUntilDone, printSection } from './test-config.js';

async function run() {
  printSection('TEST 02: PDF Vision-OCR Fallback (Scanned Document)');

  if (CONFIG.SCANNED_PDF_URL.includes('PASTE_')) {
    console.error('\x1b[31m✗ Set SCANNED_PDF_URL in test-config.js first.\x1b[0m');
    process.exit(1);
  }

  const caseBriefId = await createCase('Test Case — Scanned PDF');

  const sessionId = await initSession({
    prompt: 'I scanned a notice I received from my landlord. Please review it.',
    caseBriefId,
    fileUrl: `${CONFIG.SCANNED_PDF_URL}?t=${Date.now()}`,
    hasPdf: true,
  });

  console.log('\n[POLLING] Waiting for vision OCR + loop to complete (can take 30-60s)...');
  const result = await pollSessionUntilDone(sessionId, { timeoutMs: 120000 });

  console.log('\n--- FINAL SESSION STATE ---');
  console.log(JSON.stringify(result, null, 2));

  const failures = [];
  if (result.status !== 'COMPLETED') failures.push(`Expected status COMPLETED, got ${result.status}`);
  if (result.caseBrief?.documents.length !== 1) {
    failures.push(`Expected exactly 1 document, got ${result.caseBrief?.documents.length ?? 0}`);
  }
  if (result.caseBrief?.documents[0]?.extractedTextLength === 0) {
    failures.push('Document extractedText is empty — vision fallback likely failed');
  }

  if (failures.length) {
    console.error('\n\x1b[31m✗ TEST FAILED:\x1b[0m');
    failures.forEach((f) => console.error(`  - ${f}`));
    console.error('\n\x1b[33mCheck your server console for a "[PARSE-PDF ERROR]" line with the actual failure reason.\x1b[0m');
    process.exit(1);
  }

  console.log('\n\x1b[32m✓ TEST 02 PASSED\x1b[0m');
  console.log(`  Extracted ${result.caseBrief.documents[0].extractedTextLength} chars via vision transcription`);
  console.log(`  Preview: "${result.caseBrief.documents[0].extractedTextPreview}..."`);
  console.log('\n\x1b[33mManually verify: does the transcribed text actually match what was in the scanned image?\x1b[0m');
  console.log('\x1b[33m(Vision OCR quality can\'t be asserted programmatically — eyeball this one.)\x1b[0m');
}

run().catch((e) => {
  console.error('\x1b[31m✗ CRITICAL ERROR:\x1b[0m', e.message);
  process.exit(1);
});