// run-intake-test.js
import { z } from 'zod';

// Configurable Parameters - Replace this with your active ngrok forwarding tunnel URL
// Ensure there are no spaces inside the string!
const NGROK_TUNNEL_URL = 'https://prosubscription-nonprolifically-jimmie.ngrok-free.dev';

async function executeIntakeIntegrationTest() {
  const targetUrl = `${NGROK_TUNNEL_URL.replace(/\/$/, '')}/api/agent/init`;
  
  // Simulated request payload matching our strict InitRequestSchema contract
  const testPayload = {
    // We updated the prompt to explicitly ask for TWO actions to test the batch tool executor
    prompt: "I leased a corporate office space in Delhi and the landlord is arbitrarily holding my security deposit. I need a full legal risk assessment done, and I also need you to immediately run a match for a verified lawyer who can handle this.",
    clientId: "d3b07384-d113-4956-a5cc-484d2d47b301",
    hasPdf: false,
    metadata: {
      jurisdiction: "Delhi",
      legalDomain: "Corporate",
      estimatedBudget: 50000
    }
  };

  console.log(`\x1b[36m[TEST] Initializing connection to Intake Front Door: ${targetUrl}\x1b[0m`);
  
  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    const status = response.status;
    const data = await response.json();

    if (status === 202) {
      console.log('\n\x1b[32m✓ SUCCESS: Intake Request Accepted!\x1b[0m');
      console.log(`Status Code: ${status} (Accepted)`);
      console.log(`Assigned Session ID: \x1b[35m${data.sessionId}\x1b[0m`);
      console.log('\n\x1b[33m[NEXT] Monitor your Next.js server console window now.');
      console.log('You should see the QStash queue chaining events.');
      console.log('Watch specifically for the [EXECUTE-TOOL] log to see if it batches multiple tools!\x1b[0m\n');
    } else {
      console.error(`\n\x1b[31m✗ FAILURE: Server rejected request with status ${status}\x1b[0m`);
      console.error('Response Details:', JSON.stringify(data, null, 2));
    }

  } catch (error) {
    console.error('\n\x1b[31m✗ CRITICAL ERROR: Failed to communicate with the Next.js server\x1b[0m');
    console.error(error.message);
  }
}

executeIntakeIntegrationTest();