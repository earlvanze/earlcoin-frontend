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

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value as Record<string, unknown>[] : [];
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
  const coc = pct(p.cocYieldPercent ?? p.coc ?? 0);
  const cap = pct(p.capRatePercent ?? p.capRate ?? p.cap_rate ?? 0);
  const lp = money(p.liquidityPoolPriceUsd ?? p.marketPrice ?? p.market_price ?? 0);
  const avm = money(p.avmPriceUsd ?? p.avm ?? 0);
  const disc = pct(p.liquidityPoolVsAvmPremiumOrDiscountPercent ?? p.tokenDiscount ?? 0);
  return `- ${address}: ${metric}. CoC ${coc}, cap ${cap}, LP ${lp}, AVM ${avm}, LP vs AVM ${disc}`;
}

function latestUserText(messages: ChatMessage[]): string {
  const lastUser = [...messages].reverse().find((m) => String(m.role || 'user') === 'user' && String(m.content || '').trim());
  return String(lastUser?.content || '').trim();
}

function extractSearchTerm(prompt: string): string {
  const quoted = prompt.match(/["“”']([^"“”']{3,})["“”']/)?.[1];
  if (quoted) return quoted.trim();
  const afterFor = prompt.match(/(?:for|about|on|at)\s+(.+)$/i)?.[1];
  if (afterFor) return afterFor.replace(/[?.!]+$/, '').trim();
  return prompt.replace(/^(tell me about|analyze|search|find|lookup|look up|what about|how about)\s+/i, '').replace(/[?.!]+$/, '').trim();
}

async function callTool(name: string, args: Record<string, unknown>, sessionId: string, id: number) {
  const response = await mcpRequest('tools/call', { name, arguments: args }, id, sessionId || undefined);
  return response.result;
}

async function findProperty(prompt: string, sessionId: string) {
  const term = extractSearchTerm(prompt);
  const search = await callTool('search_properties', { term }, sessionId, 30);
  const matches = asArray(parseToolJson(search));
  return { term, matches };
}

function summarizeProperties(title: string, props: Record<string, unknown>[], metric: (p: Record<string, unknown>) => string) {
  if (!props.length) return `${title}\n- No matching properties returned.`;
  return `${title}\n${props.slice(0, 8).map((p) => propertyLine(p, metric(p))).join('\n')}`;
}

async function runInternalInvestmentAdvisor(prompt: string, messages: ChatMessage[], sessionId: string) {
  const userText = latestUserText(messages) || prompt;
  const q = userText.toLowerCase();

  if (/platform|market index|overall market|macro|stats|statistics/.test(q)) {
    const result = await callTool(q.includes('index') ? 'get_market_index' : 'get_platform_stats', {}, sessionId, 20);
    return `LoftyAssist MCP ${q.includes('index') ? 'market index' : 'platform stats'} result:\n${resultText(result).slice(0, 3000)}`;
  }

  if (/owned|my portfolio|portfolio summary|holdings/.test(q)) {
    const tool = /history|over time|chart/.test(q) ? 'get_portfolio_history' : /owned|holdings/.test(q) ? 'get_owned_properties' : 'get_portfolio_summary';
    const args = tool === 'get_portfolio_history' ? { daysBack: 90 } : {};
    const result = await callTool(tool, args, sessionId, 21);
    return `LoftyAssist MCP ${tool} result:\n${resultText(result).slice(0, 3000)}`;
  }

  if (/order book|bids?|asks?|spread|liquidity for|buy orders?|sell orders?/.test(q)) {
    const { term, matches } = await findProperty(userText, sessionId);
    const property = matches[0];
    if (!property?.id) return `I searched for “${term}” but did not find a property to fetch an order book for.`;
    const result = await callTool('get_property_order_book', { propertyId: property.id }, sessionId, 22);
    return `Order book for ${property.address || term}:\n${resultText(result).slice(0, 3000)}`;
  }

  if (/document|docs?|p&l|financials|url|download/.test(q)) {
    const { term, matches } = await findProperty(userText, sessionId);
    const property = matches[0];
    if (!property?.id) return `I searched for “${term}” but did not find a property to fetch documents for.`;
    const result = await callTool('get_property_documents', { propertyId: property.id }, sessionId, 23);
    return `Documents for ${property.address || term}:\n${resultText(result).slice(0, 3000)}`;
  }

  if (/pm update|manager update|news|latest update|what changed|changes today|updates/.test(q)) {
    if (/today|latest|changed/.test(q) && !/for|about|at/.test(q)) {
      const result = await callTool('get_latest_updates', {}, sessionId, 24);
      return `Latest LoftyAssist updates:\n${resultText(result).slice(0, 3000)}`;
    }
    const { term, matches } = await findProperty(userText, sessionId);
    const property = matches[0];
    if (!property?.id) return `I searched for “${term}” but did not find a property to fetch PM updates for.`;
    const result = await callTool('get_property_pm_updates', { propertyId: property.id }, sessionId, 25);
    return `PM updates for ${property.address || term}:\n${resultText(result).slice(0, 3000)}`;
  }

  if (/price history|ohlc|chart|trend|momentum|volatility/.test(q)) {
    const { term, matches } = await findProperty(userText, sessionId);
    const property = matches[0];
    if (!property?.id) return `I searched for “${term}” but did not find a property to fetch market prices for.`;
    const result = await callTool('get_property_market_prices', { propertyId: property.id }, sessionId, 26);
    return `Market price history for ${property.address || term}:\n${resultText(result).slice(0, 3000)}`;
  }

  if (/profile|seller|property manager|manager reputation|reputation/.test(q)) {
    const result = await callTool('get_profiles', {}, sessionId, 27);
    return `LoftyAssist profiles/reputation result:\n${resultText(result).slice(0, 3000)}`;
  }

  if (/search|find|lookup|property|address|tell me about|analyze|compare/.test(q) && !/cashflow|yield|alpha|discount|avoid|risk|screen/.test(q)) {
    const { term, matches } = await findProperty(userText, sessionId);
    if (!matches.length) return `I searched LoftyAssist for “${term}” and did not find a match.`;
    if (matches.length === 1 || /detail|full|analyze|tell me about/.test(q)) {
      const propertyId = matches[0].id;
      const result = await callTool('get_property', { propertyId }, sessionId, 28);
      return `Property detail for ${matches[0].address || term}:\n${resultText(result).slice(0, 3500)}`;
    }
    return summarizeProperties(`Search results for “${term}”:`, matches, (p) => `match ${p.market || p.state || ''}`);
  }

  const propsResult = await callTool('get_properties', { status: 'active', market: null, propertyType: null }, sessionId, 29);
  const props = asArray(parseToolJson(propsResult));
  if (!props.length) return `I reached LoftyAssist MCP, but could not parse property data. Raw result:\n${resultText(propsResult).slice(0, 1200)}`;

  if (/avoid|risk|bad|worst|overpriced|red flag/.test(q)) {
    const avoidList = [...props]
      .filter((p) => num(p.liquidityPoolVsAvmPremiumOrDiscountPercent) > 25 || num(p.cocYieldPercent) < 3 || num(p.totalLoansUsd) > num(p.totalInvestmentUsd) * 0.75)
      .sort((a, b) => num(b.liquidityPoolVsAvmPremiumOrDiscountPercent) - num(a.liquidityPoolVsAvmPremiumOrDiscountPercent))
      .slice(0, 8);
    return summarizeProperties(`I screened ${props.length} active properties. Names I would scrutinize first:`, avoidList, (p) => `risk flag LP vs AVM ${pct(p.liquidityPoolVsAvmPremiumOrDiscountPercent)}`);
  }

  if (/alpha|discount|undervalued|nav|avm|upside/.test(q)) {
    const discounted = [...props]
      .filter((p) => num(p.liquidityPoolVsAvmPremiumOrDiscountPercent) < 0)
      .sort((a, b) => num(a.liquidityPoolVsAvmPremiumOrDiscountPercent) - num(b.liquidityPoolVsAvmPremiumOrDiscountPercent))
      .slice(0, 8);
    return summarizeProperties(`I screened ${props.length} active properties. Best apparent discounts vs AVM:`, discounted, (p) => `LP vs AVM ${pct(p.liquidityPoolVsAvmPremiumOrDiscountPercent)}`);
  }

  if (/screen|filter/.test(q)) {
    const highYield = [...props].filter((p) => num(p.cocYieldPercent) >= 10).sort((a, b) => num(b.cocYieldPercent) - num(a.cocYieldPercent)).slice(0, 8);
    return summarizeProperties(`I ran a simple high-yield screen across ${props.length} active properties:`, highYield, (p) => `CoC ${pct(p.cocYieldPercent)}`);
  }

  const topCashflow = [...props]
    .filter((p) => num(p.cocYieldPercent) > 0)
    .sort((a, b) => num(b.cocYieldPercent) - num(a.cocYieldPercent))
    .slice(0, 8);
  return summarizeProperties(`I interpreted your question as a cashflow/yield screen across ${props.length} active properties:`, topCashflow, (p) => `CoC ${pct(p.cocYieldPercent)}`);
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
    const agent = String(body?.agent || 'lofty-assist-intel');

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

    const answer = await runInternalInvestmentAdvisor(prompt, messages, sessionId);
    return jsonResponse(200, { answer, tool: 'lofty-assist-intel', source: 'supabase-edge+mcp-tools' });
  } catch (err) {
    return jsonResponse(502, { error: err instanceof Error ? err.message : String(err) });
  }
});
