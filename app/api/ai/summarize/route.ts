/**
 * POST /api/ai/summarize
 *
 * Accepts raw call notes and returns a structured JSON summary extracted by
 * Claude 3.5 Sonnet via forced tool use.
 *
 * SECURITY: The ANTHROPIC_API_KEY is a server-side-only environment variable.
 * It is NOT prefixed with NEXT_PUBLIC_ and therefore never bundled into or
 * exposed through client-side JavaScript.  This route is the only code path
 * that touches the API key at runtime.
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '@/lib/require-auth'

// ─────────────────────────────────────────────────────────────────────────────
// SDK client  (instantiated once at module load — safe on the server)
// ─────────────────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({
  // Falls back to process.env.ANTHROPIC_API_KEY automatically if omitted,
  // but explicit is safer for runtime error messages.
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// ─────────────────────────────────────────────────────────────────────────────
// Structured output schema (enforced via tool use)
// ─────────────────────────────────────────────────────────────────────────────

const EXTRACT_TOOL: Anthropic.Tool = {
  name:        'extract_call_summary',
  description: 'Extract structured intelligence from a client call log or meeting notes.',
  input_schema: {
    type: 'object',
    properties: {
      clientMood: {
        type: 'string',
        enum: ['Very Positive', 'Positive', 'Neutral', 'Concerned', 'Negative', 'Very Negative'],
        description:
          'Overall client sentiment observed during the call. Use the extremes only when clearly evident — default toward Neutral when uncertain.',
      },
      projectBlockers: {
        type:  'array',
        items: { type: 'string' },
        description:
          'Concrete issues that could impede project progress: missing documents, outstanding approvals, software access problems, data discrepancies, staff changes, or client-side delays. Be specific.',
      },
      newScopingOpportunities: {
        type:  'array',
        items: { type: 'string' },
        description:
          'Additional services, feature expansions, or new engagement work the client mentioned or implied — e.g. payroll setup, tax planning, new entity structuring, software migrations.',
      },
      deadlineChanges: {
        type:  'array',
        items: {
          type: 'object',
          properties: {
            item:             { type: 'string', description: 'The deliverable or milestone affected.' },
            newDeadline:      { type: 'string', description: 'The new deadline as stated (e.g. "end of Q3 2026" or "July 15").' },
            previousDeadline: { type: 'string', description: 'The previous deadline if explicitly mentioned.' },
            urgency:          {
              type: 'string',
              enum: ['Low', 'Medium', 'High', 'Critical'],
              description: 'How time-sensitive this change is based on context.',
            },
          },
          required: ['item', 'newDeadline', 'urgency'],
        },
        description:
          'Only include explicitly stated deadline changes — do not infer or assume changes that were not directly discussed.',
      },
    },
    required: ['clientMood', 'projectBlockers', 'newScopingOpportunities', 'deadlineChanges'],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// System prompt  (marked for prompt-cache reuse across repeated calls)
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `\
You are an expert accounting firm client success specialist and project manager.

Your job is to analyse raw call notes or meeting transcripts from client interactions
and extract structured intelligence that can be actioned by the internal team.

EXTRACTION RULES:
────────────────
1. clientMood
   Assess the dominant emotional tone of the CLIENT (not the account manager).
   Reserve "Very Positive" / "Very Negative" for clear, unambiguous cases.
   When the notes contain no emotional signal, return "Neutral".

2. projectBlockers
   List only concrete, specific blockers — things that will actively prevent
   progress if left unresolved.  Generic statements like "client is busy"
   are NOT blockers unless they directly block a deliverable.
   Return an empty array if no blockers were mentioned.

3. newScopingOpportunities
   Identify upsell or cross-sell signals: new services the client needs,
   expanding the current SOW, or follow-on work discussed.
   Return an empty array if none were mentioned.

4. deadlineChanges
   Only capture deadline changes that were EXPLICITLY stated on the call.
   Do not infer, guess, or add deadlines that were not directly discussed.
   Return an empty array if no changes were mentioned.

You MUST respond by calling the extract_call_summary tool.
Do NOT reply with plain text — only the tool call is acceptable.`

// ─────────────────────────────────────────────────────────────────────────────
// Response types
// ─────────────────────────────────────────────────────────────────────────────

interface DeadlineChange {
  item:              string
  newDeadline:       string
  previousDeadline?: string
  urgency:           'Low' | 'Medium' | 'High' | 'Critical'
}

interface CallSummary {
  clientMood:                'Very Positive' | 'Positive' | 'Neutral' | 'Concerned' | 'Negative' | 'Very Negative'
  projectBlockers:           string[]
  newScopingOpportunities:   string[]
  deadlineChanges:           DeadlineChange[]
}

interface SummarizeResponse {
  summary:   CallSummary
  /** Token usage — useful for monitoring and cost tracking. */
  usage: {
    inputTokens:      number
    outputTokens:     number
    cacheReadTokens:  number
    cacheWriteTokens: number
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/ai/summarize
 *
 * Body: { "callNotes": "raw text from the call…", "clientName"?: "optional context" }
 *
 * Returns: SummarizeResponse — structured JSON extracted by Claude 3.5 Sonnet.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const gate = await requireAuth(req); if (gate) return gate;

  // ── Validate API key is configured ──────────────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[ai/summarize] ANTHROPIC_API_KEY is not set')
    return NextResponse.json(
      { error: 'AI service is not configured — ANTHROPIC_API_KEY missing' },
      { status: 503 },
    )
  }

  // ── Parse and validate request body ─────────────────────────────────────
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const { callNotes, clientName } = (body ?? {}) as Record<string, unknown>

  if (typeof callNotes !== 'string' || callNotes.trim().length === 0) {
    return NextResponse.json(
      { error: '"callNotes" is required and must be a non-empty string' },
      { status: 422 },
    )
  }

  if (callNotes.trim().length < 20) {
    return NextResponse.json(
      { error: '"callNotes" must be at least 20 characters — too short to extract meaningful data' },
      { status: 422 },
    )
  }

  // ── Build user message ───────────────────────────────────────────────────
  const clientContext = typeof clientName === 'string' && clientName.trim()
    ? `Client: ${clientName.trim()}\n\n`
    : ''

  const userMessage = `${clientContext}Please analyse these call notes and extract the structured summary:\n\n---\n${callNotes.trim()}\n---`

  // ── Call Claude 3.5 Sonnet with forced tool use ──────────────────────────
  let response: Awaited<ReturnType<typeof anthropic.messages.create>>
  try {
    response = await anthropic.messages.create({
      model:      'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      // Cache the system prompt — reused across calls within the 5-minute TTL,
      // reducing cost and latency for high-volume usage.
      system: [
        {
          type:          'text',
          text:          SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools:       [EXTRACT_TOOL],
      // Force Claude to call extract_call_summary — prevents plain-text fallback.
      tool_choice: { type: 'tool', name: 'extract_call_summary' },
      messages: [
        { role: 'user', content: userMessage },
      ],
    })
  } catch (err) {
    const message = err instanceof Anthropic.APIError
      ? `Anthropic API error ${err.status}: ${err.message}`
      : err instanceof Error
        ? err.message
        : String(err)
    console.error('[ai/summarize] Claude call failed:', message)
    return NextResponse.json({ error: `AI extraction failed: ${message}` }, { status: 502 })
  }

  // ── Extract the tool-use result block ────────────────────────────────────
  const toolBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  )

  if (!toolBlock) {
    console.error('[ai/summarize] Claude returned no tool_use block:', JSON.stringify(response.content))
    return NextResponse.json(
      { error: 'Extraction failed — Claude did not call the expected tool' },
      { status: 500 },
    )
  }

  const summary = toolBlock.input as CallSummary

  const result: SummarizeResponse = {
    summary,
    usage: {
      inputTokens:      response.usage.input_tokens,
      outputTokens:     response.usage.output_tokens,
      // cache_read_input_tokens and cache_creation_input_tokens are present
      // when prompt caching is active.  The Anthropic SDK's Usage type doesn't
      // yet declare these fields, so we go through unknown to access them safely.
      cacheReadTokens:  ((response.usage as unknown) as Record<string, number>).cache_read_input_tokens  ?? 0,
      cacheWriteTokens: ((response.usage as unknown) as Record<string, number>).cache_creation_input_tokens ?? 0,
    },
  }

  return NextResponse.json(result)
}

/**
 * GET /api/ai/summarize
 *
 * Returns endpoint metadata, the output schema, and an example response.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const gate = await requireAuth(req); if (gate) return gate;

  return NextResponse.json({
    endpoint:    'POST /api/ai/summarize',
    model:       'claude-3-5-sonnet-20241022',
    description: 'Extracts structured intelligence from raw call notes using Claude 3.5 Sonnet.',
    requiredEnv: [
      'ANTHROPIC_API_KEY — Anthropic platform API key (console.anthropic.com)',
    ],
    requestSchema: {
      callNotes:  'string (required, min 20 chars) — raw call notes or transcript',
      clientName: 'string (optional) — client name for additional context',
    },
    responseSchema: {
      summary: {
        clientMood:              "'Very Positive' | 'Positive' | 'Neutral' | 'Concerned' | 'Negative' | 'Very Negative'",
        projectBlockers:         'string[] — concrete issues blocking progress',
        newScopingOpportunities: 'string[] — upsell / expansion signals',
        deadlineChanges: [{
          item:             'string — affected deliverable or milestone',
          newDeadline:      'string — new deadline as stated',
          previousDeadline: 'string (optional) — previous deadline if mentioned',
          urgency:          "'Low' | 'Medium' | 'High' | 'Critical'",
        }],
      },
      usage: {
        inputTokens:      'number',
        outputTokens:     'number',
        cacheReadTokens:  'number — tokens served from prompt cache (cost savings)',
        cacheWriteTokens: 'number — tokens written to prompt cache',
      },
    },
    exampleResponse: {
      summary: {
        clientMood: 'Concerned',
        projectBlockers: [
          'Client has not provided Q1 bank statements — reconciliation is blocked',
          'Gusto payroll integration requires new admin credentials',
        ],
        newScopingOpportunities: [
          'Client asked about setting up a second LLC — potential new entity engagement',
          'Interest in annual tax planning session before Q4',
        ],
        deadlineChanges: [
          {
            item:             'Q1 bookkeeping close',
            newDeadline:      'June 20, 2026',
            previousDeadline: 'June 10, 2026',
            urgency:          'High',
          },
        ],
      },
      usage: { inputTokens: 520, outputTokens: 180, cacheReadTokens: 310, cacheWriteTokens: 0 },
    },
  })
}
