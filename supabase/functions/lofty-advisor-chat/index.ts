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

async function mcpRequest(method: string, params: Record<string, unknown>, id: number | null, sessionId?: string) {
  const headers: Record<string, string> = {
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${LOFTYASSIST_API_KEY}`,
    'User-Agent': 'EarlCoin-LoftyAdvisor/1.0',
  };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;

  const message = id == null
    ? { jsonrpc: '2.0', method, params }
    : { jsonrpc: '2.0', id, method, params };

  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(message),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`MCP HTTP ${res.status}: ${text.slice(0, 300)}`);

  const nextSessionId = res.headers.get('mcp-session-id') || res.headers.get('Mcp-Session-Id') || sessionId;
  if (!text.trim()) return { result: null, sessionId: nextSessionId };

  const decoded = parseSseJson(text);
  if (decoded?.error) throw new Error(decoded.error?.message || JSON.stringify(decoded.error));
  return { result: decoded?.result ?? decoded, sessionId: nextSessionId };
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

function parseToolJson(result: unknown): unknown {
  const text = resultText(result);
  try { return JSON.parse(text); } catch (_) { return text; }
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value: unknown): string {
  const n = num(value);
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function pct(value: unknown): string {
  const n = num(value);
  return `${n.toFixed(1)}%`;
}

function propertyLine(p: Record<string, unknown>, metric: string): string {
  const address = String(p.address || 'Unknown property');
  const coc = pct(p.cocYieldPercent);
  const cap = pct(p.capRatePercent);
  const lp = money(p.liquidityPoolPriceUsd);
  const avm = money(p.avmPriceUsd);
  const disc = pct(p.liquidityPoolVsAvmPremiumOrDiscountPercent);
  return `- ${address}: ${metric}. CoC ${coc}, cap ${cap}, LP ${lp}, AVM ${avm}, LP vs AVM ${disc}`;
}

async function runInternalInvestmentAdvisor(prompt: string, sessionId: string) {
  const response = await mcpRequest('tools/call', {
    name: 'get_properties',
    arguments: { status: 'active', market: null, propertyType: null },
  }, 20, sessionId || undefined);

  const parsed = parseToolJson(response.result);
  if (!Array.isArray(parsed)) {
    return `I reached LoftyAssist MCP, but could not parse the property list yet. Raw result:\n${resultText(response.result).slice(0, 1200)}`;
  }

  const props = parsed as Record<string, unknown>[];
  const q = prompt.toLowerCase();
  const wantsAvoid = /avoid|risk|bad|worst|overpriced|red flag/.test(q);
  const wantsAlpha = /alpha|discount|undervalued|nav|avm|upside/.test(q);
  const wantsCashflow = /cash|yield|coc|income|rent/.test(q) || (!wantsAvoid && !wantsAlpha);

  const topCashflow = [...props]
    .filter((p) => num(p.cocYieldPercent) > 0)
    .sort((a, b) => num(b.cocYieldPercent) - num(a.cocYieldPercent))
    .slice(0, 5);
  const topDiscount = [...props]
    .filter((p) => num(p.liquidityPoolVsAvmPremiumOrDiscountPercent) < 0)
    .sort((a, b) => num(a.liquidityPoolVsAvmPremiumOrDiscountPercent) - num(b.liquidityPoolVsAvmPremiumOrDiscountPercent))
    .slice(0, 5);
  const avoidList = [...props]
    .filter((p) => num(p.liquidityPoolVsAvmPremiumOrDiscountPercent) > 25 || num(p.cocYieldPercent) < 3 || num(p.totalLoansUsd) > num(p.totalInvestmentUsd) * 0.75)
    .sort((a, b) => num(b.liquidityPoolVsAvmPremiumOrDiscountPercent) - num(a.liquidityPoolVsAvmPremiumOrDiscountPercent))
    .slice(0, 5);

  const sections: string[] = [];
  sections.push(`I pulled ${props.length} active properties from LoftyAssist MCP and ranked them for research support, not financial advice.`);

  if (wantsCashflow) {
    sections.push(`\nBest cashflow/yield candidates:\n${topCashflow.map((p) => propertyLine(p, `CoC ${pct(p.cocYieldPercent)}`)).join('\n')}`);
  }
  if (wantsAlpha) {
    sections.push(`\nBest apparent alpha/discount candidates vs AVM:\n${topDiscount.length ? topDiscount.map((p) => propertyLine(p, `LP vs AVM ${pct(p.liquidityPoolVsAvmPremiumOrDiscountPercent)}`)).join('\n') : '- I did not find active properties trading below AVM in this pull.'}`);
  }
  if (wantsAvoid) {
    sections.push(`\nNames I would scrutinize or avoid first:\n${avoidList.length ? avoidList.map((p) => propertyLine(p, `risk flag LP vs AVM ${pct(p.liquidityPoolVsAvmPremiumOrDiscountPercent)}`)).join('\n') : '- No obvious avoid-list names triggered the simple premium/low-yield/debt screens.'}`);
  }

  sections.push('\nNext step: for any specific property, ask by address and I can pull property-level details/updates/documents from MCP.');
  return sections.join('\n');
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

    let sessionId = '';
    try {
      const init = await mcpRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'EarlCoin Lofty Advisor', version: '1.0.0' },
      }, 1);
      sessionId = init.sessionId || '';
      if (sessionId) {
        await mcpRequest('notifications/initialized', {}, null, sessionId);
      }
    } catch (_) {
      // Some MCP gateways do not require lifecycle initialization.
    }

    const listed = await mcpRequest('tools/list', {}, 2, sessionId || undefined);
    const tools = Array.isArray((listed.result as { tools?: unknown[] })?.tools) ? (listed.result as { tools: Array<{ name?: string }> }).tools : [];
    const toolNames = tools.map((tool) => tool.name).filter(Boolean) as string[];

    if (toolNames.includes(agent)) {
      const response = await mcpRequest('tools/call', {
        name: agent,
        arguments: { prompt, question: prompt, messages },
      }, 10, sessionId || undefined);
      return jsonResponse(200, { answer: resultText(response.result), tool: agent, source: 'supabase-edge' });
    }

    const answer = await runInternalInvestmentAdvisor(prompt, sessionId);
    return jsonResponse(200, { answer, tool: 'internal-investment-advisor', source: 'supabase-edge+mcp-tools' });
  } catch (err) {
    return jsonResponse(502, { error: err instanceof Error ? err.message : String(err) });
  }
});
