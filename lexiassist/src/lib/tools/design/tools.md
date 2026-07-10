These four tools represent the complete core functional capabilities of the **LEXIASSIST** application architecture. They map directly to the specialized roles required to handle structured legal workflows.

Here is exactly what each tool does and how it functions inside your background execution circuit:

---

### 1. `extractCaseChronology`

* **The Role:** The Intake Paralegal (Triage).


* **What it does:** It processes unstructured, emotional narrative text from the user or parsed documents. It isolates names, dates, and factual assertions, organizing them into a strictly ordered chronological sequence.


* **Why it's production-grade:** It requires the AI model to include a `verifiableSourceCitation` for every single event block. This forces the agent's attention weights to grab concrete proof directly from the uploaded documents rather than guessing or hallucinating facts.



### 2. `generatePreBriefRisk`

* **The Role:** The Junior Associate (Risk Assessment Engine).


* **What it does:** It acts as the first-pass reviewer to compute financial values and legal risks. It outputs an estimated case value and flags critical regulatory issues.


* **Why it's production-grade:** It includes a deterministic boolean flag `statuteOfLimitationsWarning`. If the dates extracted from the narrative show the user is running out of legal time to file a claim, the system can instantly alert the client and the lawyer on the dashboard view.



### 3. `generateDocumentRedlines`

* **The Role:** The Junior Associate (Contract Auditor).


* **What it does:** This tool drives the side-by-side comparative UI. It maps specific, aggressive text snippets from a contract or legal notice on the left side, then provides suggested redline replacements and explicit rationales on the right side.


* **Why it's production-grade:** By combining a strict error classification enum (`LOW` to `CRITICAL`) with precise text snippet tracking, your frontend can use high-performance rendering to map updates cleanly without relying on brittle regular expressions.

### 4. `matchVerifyLawyer`

* **The Role:** The Matchmaker (Routing Engine).


* **What it does:** It processes the extracted case parameters (jurisdiction, specific domain type, budget limit) to generate database queries against your verified lawyer roster.


* **Why it's production-grade:** It completely sanitizes the routing request. Instead of letting the LLM talk loosely about where a case belongs, it forces the model to select a strict enum classification (e.g., `Property`, `Employment`, `Corporate`) to ensure accurate matching.

---

### How They Behave Over the Wire

Because these tools **omit the `execute` property**, they act as **structural interrupts** in the Vercel AI SDK.

When the orchestration brain (`/api/agent/loop`) invokes the model, the model does not run any local code. Instead, it generates a structured data envelope matching the exact schema shape. The loop route catches this envelope, packages it up, and securely shoots it over your QStash webhook circuit to the execution container.

Now that the exact functionality of these tools is clear, how would you like to proceed? We can build the database schema using your global singleton connection pattern to map these data models, or write the synchronous `init` endpoint logic to begin processing incoming user requests.