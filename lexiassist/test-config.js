// test-config.js
// Shared config for all test scripts. Fill these in before running anything.

export const CONFIG = {
  // Your active ngrok tunnel — no trailing slash
  BASE_URL: 'https://prosubscription-nonprolifically-jimmie.ngrok-free.dev',

  // Any valid UUID — represents the test client
  CLIENT_ID: '7e4c2e1f-8714-4619-8192-2f491753b5f3',

  // ---- FILE URLS ----
  // Upload two test PDFs through your actual UploadThing flow first
  // (via your frontend, or UploadThing's dashboard test uploader), then
  // paste the resulting public URLs here.
  //
  // TEXT_LAYER_PDF: any normal PDF with real selectable text — a lease,
  // a contract, an exported Google Doc. This exercises the fast unpdf path.
  //
  // SCANNED_PDF: a PDF made from a photo or scan of a printed page — no
  // selectable text layer. Easiest way to make one: take a photo of a
  // printed page on your phone, then "Print to PDF" the photo, OR scan
  // a real document with a scanner app (many phone scanner apps export
  // image-only PDFs by default). This exercises the Gemini vision fallback.
  TEXT_LAYER_PDF_URL: 'https://utfs.io/f/8KNDHE3O04CNW4WoBfRvAktbZiQaF0Y1cyjodx39elUnuHzq',
  SCANNED_PDF_URL: 'https://utfs.io/f/8KNDHE3O04CNzmN8BvQJLu96FamTQ4cBDAXNfHJi8O0MYgVb',
};

// ---- Shared helpers ----

export async function createCase(title) {
  const res = await fetch(`${CONFIG.BASE_URL}/api/cases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: CONFIG.CLIENT_ID, title }),
  });
  const data = await res.json();
  if (res.status !== 201) {
    throw new Error(`createCase failed (${res.status}): ${JSON.stringify(data)}`);
  }
  console.log(`\x1b[32m✓ Case created: ${data.caseBriefId} ("${title}")\x1b[0m`);
  return data.caseBriefId;
}

export async function initSession({ prompt, caseBriefId, fileUrl, hasPdf = false, metadata = {} }) {
  const res = await fetch(`${CONFIG.BASE_URL}/api/agent/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      clientId: CONFIG.CLIENT_ID,
      caseBriefId,
      fileUrl,
      hasPdf,
      metadata,
    }),
  });
  const data = await res.json();
  if (res.status !== 202) {
    throw new Error(`init failed (${res.status}): ${JSON.stringify(data)}`);
  }
  console.log(`\x1b[32m✓ Session dispatched: ${data.sessionId}\x1b[0m`);
  return data.sessionId;
}

export async function continueSession({ sessionId, userReply, caseBriefId }) {
  // Using init with sessionId per your architecture (init handles both
  // new-session and continuation branches via the optional sessionId field)
  const res = await fetch(`${CONFIG.BASE_URL}/api/agent/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: userReply,
      clientId: CONFIG.CLIENT_ID,
      sessionId,
      caseBriefId,
    }),
  });
  const data = await res.json();
  if (res.status !== 202) {
    throw new Error(`continue (via init) failed (${res.status}): ${JSON.stringify(data)}`);
  }
  console.log(`\x1b[32m✓ Continuation dispatched: ${data.sessionId}\x1b[0m`);
  return data.sessionId;
}

// Polls GET /api/agent/sessions/:id until status leaves PROCESSING,
// or times out. This is what actually lets a test script assert on
// results instead of eyeballing the console.
export async function pollSessionUntilDone(sessionId, { timeoutMs = 60000, intervalMs = 2000 } = {}) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${CONFIG.BASE_URL}/api/agent/sessions/${sessionId}`);
    // --- ADD THIS CHECK ---
    if (!res.ok) {
        const rawText = await res.text();
        throw new Error(`\nPolling route failed (${res.status}).\nRaw response: ${rawText.substring(0, 500)}`);
    }
    const data = await res.json();

    if (data.status && data.status !== 'PROCESSING') {
      console.log(`\x1b[36m[POLL] Session settled with status: ${data.status} (${Date.now() - start}ms)\x1b[0m`);
      return data;
    }

    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(`Timed out after ${timeoutMs}ms waiting for session ${sessionId} to leave PROCESSING`);
}

export function printSection(title) {
  console.log(`\n\x1b[35m${'='.repeat(60)}\n${title}\n${'='.repeat(60)}\x1b[0m`);
}