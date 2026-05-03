import { corsHeaders } from '../_shared/cors.ts';

type ChatMessage = { role?: string; content?: string };

const MCP_URL = 'https://www.loftyassist.com/mcp';
const LOFTYASSIST_API_KEY = Deno.env.get('LOFTYASSIST_API_KEY') ?? Deno.env.get('LOFTYASSIST_MCP_TOKEN') ?? '';

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function buildPrompt(messages: ChatMessage[]) {
  return messages
    .map((message) => {
      const role = String(message.role || 'user').replace(/[^a-z_-]/gi, '') || 'user';
      const content = String(message.content || '').trim();
      return content ? `${role.toUpperCase()}: ${content}` : '';
    })
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

function parseSseJson(body: string) {
  if (!body.includes('data:')) return JSON.parse(body);
  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const candidate = line.slice(5).trim();
    if (candidate && candidate !== '[DONE]') return JSON.parse(candidate);
  }
  throw new Error('MCP returned an empty event stream');
}

async function mcpRequest(method: string, params: Record<string, unknown>, id: number) {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LOFTYASSIST_API_KEY}`,
      'User-Agent': 'EarlCoin-LoftyAdvisor/1.0',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`MCP HTTP ${res.status}: ${text.slice(0, 300)}`);

  const decoded = parseSseJson(text);
  if (decoded?.error) throw new Error(decoded.error?.message || JSON.stringify(decoded.error));
  return decoded?.result ?? decoded;
}

function resultText(result: unknown): string {
  if (typeof result === 'string') return result;
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>;
    if (Array.isArray(r.content)) {
      const parts = r.content
        .map((part) => {
          if (typeof part === 'string') return part;
          if (part && typeof part === 'object' && 'text' in part) return String((part as { text: unknown }).text || '');
          return '';
        })
        .filter(Boolean);
      if (parts.length) return parts.join('\n');
    }
    if (typeof r.answer === 'string') return r.answer;
    if (typeof r.text === 'string') return r.text;
  }
  return JSON.stringify(result, null, 2);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'method not allowed' });

  try {
    if (!LOFTYASSIST_API_KEY) {
      return jsonResponse(503, { error: 'LOFTYASSIST_API_KEY is not configured in Supabase secrets' });
    }

    const body = await req.json();
    const messages = Array.isArray(body?.messages) ? body.messages as ChatMessage[] : [];
    const prompt = buildPrompt(messages);
    const agent = String(body?.agent || 'investment-advisor');

    if (!prompt) return jsonResponse(400, { error: 'messages are required' });

    try {
      await mcpRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'EarlCoin Lofty Advisor', version: '1.0.0' },
      }, 1);
    } catch (_) {
      // Some MCP gateways do not require lifecycle initialization.
    }

    const toolNames = [...new Set([agent, 'investment_advisor', 'investment-advisor', 'advisor', 'chat', 'ask'])];
    let lastError = '';
    for (const toolName of toolNames) {
      try {
        const result = await mcpRequest('tools/call', {
          name: toolName,
          arguments: { prompt, question: prompt, messages },
        }, 10);
        return jsonResponse(200, { answer: resultText(result), tool: toolName, source: 'supabase-edge' });
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    throw new Error(lastError || 'No compatible investment advisor tool found on MCP server');
  } catch (err) {
    return jsonResponse(502, { error: err instanceof Error ? err.message : String(err) });
  }
});
