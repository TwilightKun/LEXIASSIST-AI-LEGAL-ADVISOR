// test-04-document-redlines.js
//
// WHAT THIS TESTS: executeGenerateDocumentRedlines end to end. This is the
// most dependency-heavy test: it needs parse-pdf to succeed FIRST (to create
// a Document row with a real documentId embedded in the message history)
// before redlining can target anything.
//
// USE A REAL CONTRACT-LIKE PDF for TEXT_LAYER_PDF_URL for this test —
// something with actual clauses (a lease, an NDA, a services agreement).
// A random text PDF with no legal-style clauses will make it hard for the
// model to produce meaningful flaggedClauses, and you won't be able to tell
// whether a failure is a real bug or just "there was nothing to flag."
//
// WHAT SUCCESS LOOKS LIKE:
//   - caseBrief.documents[0].redlines is a non-empty array
//   - each entry has riskSeverity in [LOW, MEDIUM, HIGH, CRITICAL]
//   - at least some entries have verified: true (same logic/caveat as
//     the chronology test — verified checks against Document.extractedText
//     specifically, not the whole conversation)

import { CONFIG, createCase, initSession, continueSession, pollSessionUntilDone, printSection } from './test-config.js';

async function run() {
  printSection('TEST 04: Document Redlining');

  if (CONFIG.TEXT_LAYER_PDF_URL.includes('PASTE_')) {
    console.error('\x1b[31m✗ Set TEXT_LAYER_PDF_URL in test-config.js first (use a real contract-like PDF for this test).\x1b[0m');
    process.exit(1);
  }

  const caseBriefId = await createCase('Test Case — Document Redlines');

  // Turn 1: upload the document as part of intake
  const sessionId = await initSession({
    prompt: 'Please review this contract I was asked to sign and flag anything concerning.',
    caseBriefId,
    fileUrl: `${CONFIG.SCANNED_PDF_URL}?t=${Date.now()}`,
    hasPdf: true,
  });

  console.log('\n[POLLING] Waiting for parse-pdf + turn 1 to complete...');
  let result = await pollSessionUntilDone(sessionId, { timeoutMs: 90000 });
  console.log(`Turn 1 status: ${result.status}`);

  if (!result.caseBrief?.documents?.length) {
    console.error('\x1b[31m✗ No document was created in turn 1 — cannot proceed to redlining. Check parse-pdf logs.\x1b[0m');
    process.exit(1);
  }
  const documentId = result.caseBrief.documents[0].id;
  console.log(`  Document created: ${documentId}`);

  // Turn 2: explicitly request redlines, since — like chronology — this
  // isn't auto-triggered by the current MANDATORY TOOL EXECUTION block
  await continueSession({
    sessionId,
    caseBriefId,
    userReply:
      'Go through that document clause by clause and tell me exactly which ' +
      'terms are risky or unusual, and what you would suggest changing them to.',
  });

  console.log('\n[POLLING] Waiting for turn 2 (redline generation) to complete...');
  result = await pollSessionUntilDone(sessionId, { timeoutMs: 60000 });

  console.log('\n--- FINAL SESSION STATE ---');
  console.log(JSON.stringify(result, null, 2));

  const failures = [];
  const doc = result.caseBrief?.documents?.find((d) => d.id === documentId);
  const redlines = doc?.redlines;

  if (result.status !== 'COMPLETED') failures.push(`Expected status COMPLETED, got ${result.status}`);
  if (!doc) failures.push('Document no longer found on caseBrief — unexpected');
  if (!Array.isArray(redlines) || redlines.length === 0) {
    failures.push('redlines is empty or not an array — either the tool never fired, or the model found nothing to flag (check server console)');
  }

  const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  if (Array.isArray(redlines)) {
    const badSeverity = redlines.find((r) => !validSeverities.includes(r.riskSeverity));
    if (badSeverity) failures.push(`Found invalid riskSeverity value: ${badSeverity.riskSeverity}`);
  }

  const verifiedCount = Array.isArray(redlines) ? redlines.filter((r) => r.verified === true).length : 0;

  if (failures.length) {
    console.error('\n\x1b[31m✗ TEST FAILED:\x1b[0m');
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }

  console.log('\n\x1b[32m✓ TEST 04 PASSED\x1b[0m');
  console.log(`  ${redlines.length} clauses flagged, ${verifiedCount} verified against source document`);
  redlines.forEach((r, i) => {
    console.log(`  [${i + 1}] (${r.riskSeverity}, verified=${r.verified}) ${r.rationale}`);
  });
}

run().catch((e) => {
  console.error('\x1b[31m✗ CRITICAL ERROR:\x1b[0m', e.message);
  process.exit(1);
});