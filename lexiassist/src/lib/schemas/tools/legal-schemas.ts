// src/lib/tools/legal-tools.ts
import { tool } from 'ai';
import { z } from 'zod';


// Stored shape in CaseBrief.aiTimeline — NOT the tool's input schema.
// `verified` is computed server-side in executeExtractCaseChronology, never
// supplied by the model, since the model can't be trusted to self-report this.
type StoredKeyEvent = {
  eventDate: string;
  description: string;
  verifiableSourceCitation: string;
  verified: boolean;
};

/**
 * 1. THE INTAKE PARALEGAL: Automated Case Chronology
 * Extracts the "Who, What, Where, When" from disorganized text and documents to build a verified timeline.
 */
export const extractCaseChronologySchema = z.object({
  caseSessionId: z.string().uuid().describe(
    'The unique, verified UUID identifier of the active intake session.'
  ),
  rawNarrativeSummary: z.string().min(20).describe(
    'An objective, structured chronological consolidation of the facts, stripped of emotional context.'
  ),
  involvedParties: z.array(z.string()).min(1).describe(
    'An array containing names of individuals, corporations, or institutional entities explicitly named.'
  ),
  keyEvents: z.array(
    z.object({
      eventDate: z.string().describe('The date or approximate timeline marking when the event occurred.'),
      description: z.string().describe('The discrete factual occurrence.'),
      verifiableSourceCitation: z.string().describe('The exact sentence snippet or document page number where this event is explicitly derived.')
    }).strict()
  ).min(1).describe('Chronologically sorted sequential list of actions defining the root cause of the legal dispute.')
}).strict(); // Enforces strict schema generation (no hallucinated properties)

/**
 * 2. THE JUNIOR ASSOCIATE (A): Pre-Brief Risk Engine
 * Generates the dashboard handoff view for the lawyer, identifying core risks and case value.
 */
export const generatePreBriefRiskSchema = z.object({
  caseSessionId: z.string().uuid(),
  estimatedCaseValue: z.number().int().describe(
    'The estimated monetary value or damages of the dispute in integer format.'
  ),
  primaryLegalRisks: z.array(z.string()).min(1).describe(
    'A list of the immediate legal vulnerabilities or statutory risks identified in the user narrative.'
  ),
  caseSummary: z.string().min(20).describe(
   'An objective, consolidated summary of the case synthesized from the full conversation history — not a single message, but the coherent narrative across all turns.'
 ),
  statuteOfLimitationsWarning: z.boolean().describe(
    'Set to true if dates in the chronology indicate a rapidly approaching filing deadline.'
  )
}).strict();

/**
 * 3. THE JUNIOR ASSOCIATE (B): Smart Document Redlining
 * Powers the side-by-side comparative UI, highlighting aggressive terms or missing clauses.
 */
export const generateDocumentRedlinesSchema = z.object({
  documentId: z.string().describe(
    'The ID of the uploaded document fetched from flexible storage.'
  ),
  flaggedClauses: z.array(
    z.object({
      originalTextSnippet: z.string().describe('The exact phrasing of the problematic clause from the left-side original document.'),
      riskSeverity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
      suggestedRedline: z.string().describe('The proposed safer legal text to display dynamically on the right-side UI.'),
      rationale: z.string().describe('A brief legal explanation for why the change is necessary.')
    }).strict()
  ).describe('An array of structural changes required to neutralize contract risks.')
}).strict();

/**
 * 4. THE MATCHMAKER: Lawyer Routing Engine
 * Algorithmically routes the structured case facts to verified counsel.
 */
export const matchVerifyLawyerSchema = z.object({
  caseSessionId: z.string().uuid(),
  jurisdiction: z.string().min(2).describe(
    'The explicit legal jurisdiction where the dispute must be litigated (e.g., "Delhi", "Maharashtra").'
  ),
  legalDomain: z.enum(['Criminal Law', 'Corporate Law', 'Property Law', 'Family Law', 'Employment Law', 'Banking Law']).describe(
    'The absolute legal specialization required for the dispute.'
  ),
  budgetLimitBracket: z.number().int().positive().describe(
    'The maximum acceptable monetary retainer threshold specified by the client.'
  )
}).strict();


// ------------------------------------------------------------------
// EXPORTED AI SDK TOOLS
// We wrap the strict Zod schemas inside the AI SDK tool() definitions. 
// We omit the 'execute' function to prevent synchronous execution, allowing QStash to handle it asynchronously.
// ------------------------------------------------------------------

export const legalTools = {
  extractCaseChronology: tool({
    description: 'Compiles messy user narratives and uploaded files into a verifiable chronological case timeline.',
    inputSchema: extractCaseChronologySchema,
  }),
  
  generatePreBriefRisk: tool({
    description: 'Generates a preliminary legal risk assessment and estimated case value for the lawyer handoff dashboard.',
    inputSchema: generatePreBriefRiskSchema,
  }),

  generateDocumentRedlines: tool({
    description: 'Analyzes legal contracts or notices to identify missing clauses, flag aggressive terms, and propose redlined alternatives.',
    inputSchema: generateDocumentRedlinesSchema,
  }),

  matchVerifyLawyer: tool({
    description: 'Cross-references extracted client context (jurisdiction, budget, domain) against the primary database to route to a verified lawyer.',
    inputSchema: matchVerifyLawyerSchema,
  }),
};

// Export inferred types for safe, strict backend parsing in your execution webhooks
export type ExtractCaseChronologyInput = z.infer<typeof extractCaseChronologySchema>;
export type GeneratePreBriefRiskInput = z.infer<typeof generatePreBriefRiskSchema>;
export type GenerateDocumentRedlinesInput = z.infer<typeof generateDocumentRedlinesSchema>;
export type MatchVerifyLawyerInput = z.infer<typeof matchVerifyLawyerSchema>;