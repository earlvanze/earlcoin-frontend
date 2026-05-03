import { corsHeaders } from '../_shared/cors.ts';

type ChatMessage = { role?: string; content?: string };

const MCP_URL = 'https://www.loftyassist.com/mcp';
const LOFTYASSIST_API_KEY = Deno.env.get('LOFTYASSIST_API_KEY') ?? Deno.env.get('LOFTYASSIST_MCP_TOKEN') ?? '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY') ?? '';
const LLM_API_KEY = OPENROUTER_API_KEY || OPENAI_API_KEY;
const LLM_BASE_URL = OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1';
const OPENAI_MODEL = Deno.env.get('COMPASS_YIELD_MODEL') ?? Deno.env.get('OPENAI_MODEL') ?? (OPENROUTER_API_KEY ? 'openai/gpt-4o-mini' : 'gpt-5-mini');

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


type McpTool = { name?: string; description?: string; inputSchema?: Record<string, unknown> };

type OpenAIMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
};

function normalizeSchema(schema: unknown): Record<string, unknown> {
  if (schema && typeof schema === 'object') return schema as Record<string, unknown>;
  return { type: 'object', additionalProperties: true };
}

function chatMessagesForOpenAI(messages: ChatMessage[]): OpenAIMessage[] {
  return messages
    .map((message) => {
      const role = String(message.role || 'user') === 'assistant' ? 'assistant' : 'user';
      const content = String(message.content || '').trim();
      return content ? { role, content } as OpenAIMessage : null;
    })
    .filter(Boolean) as OpenAIMessage[];
}

const COMPASS_YIELD_SYSTEM_PROMPT = `You are Compass Yield, EarlCoin's investment-advisor agent.
You are an actual reasoning layer over LoftyAssist MCP tools. LoftyAssist MCP is only the data/tool layer.

Scope:
- Analyze Lofty real estate token opportunities, yield, LP strategy, order books, price history, platform stats, PM updates, documents, risk, and portfolio fit.
- Use LoftyAssist MCP tools whenever live/current facts are needed. Do not pretend to have data you did not fetch.
- Be concise, analytical, and direct. Prefer bullets over tables.
- Clearly separate data, interpretation, and uncertainty.
- You provide research support, not financial advice.

Compass Yield style:
- Start with the answer, then supporting evidence.
- For property questions, search first if the property id is unknown, then fetch full details or order book as needed.
- For screening questions, use get_properties or run_screener, then rank with explicit criteria.
- For risk questions, check price/yield/liquidity/order-book/PM-update/profile signals when relevant.
- If a user asks for a model, recommendation, or allocation, give a practical framework and caveats.
`;


function selectedMcpToolsForPrompt(prompt: string, tools: McpTool[]): McpTool[] {
  const q = prompt.toLowerCase();
  const names = new Set<string>(['search_properties', 'get_property', 'get_properties']);
  if (/order book|bid|ask|spread|liquidity/.test(q)) names.add('get_property_order_book');
  if (/price history|ohlc|chart|trend|momentum|volatility/.test(q)) names.add('get_property_market_prices');
  if (/document|docs?|p&l|financial|download/.test(q)) names.add('get_property_documents');
  if (/pm|manager|update|news|changed|changes/.test(q)) { names.add('get_property_pm_updates'); names.add('get_latest_updates'); }
  if (/profile|seller|manager reputation|reputation/.test(q)) names.add('get_profiles');
  if (/platform|market index|macro|stats|statistics/.test(q)) { names.add('get_platform_stats'); names.add('get_market_index'); }
  if (/portfolio|owned|holdings|my /.test(q)) { names.add('get_portfolio_summary'); names.add('get_owned_properties'); names.add('get_portfolio_history'); }
  if (/screen|filter/.test(q)) names.add('run_screener');
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  return [...names]
    .map((name) => byName.get(name))
    .filter(Boolean)
    .map((tool) => ({ name: tool!.name, description: tool!.description, inputSchema: compactToolSchema(String(tool!.name)) }));
}

function compactToolSchema(name: string): Record<string, unknown> {
  if (name === 'search_properties') return { type: 'object', properties: { term: { type: 'string' } }, required: ['term'] };
  if (['get_property', 'get_property_order_book', 'get_property_market_prices', 'get_property_pm_updates', 'get_property_documents'].includes(name)) {
    return { type: 'object', properties: { propertyId: { type: 'string' } }, required: ['propertyId'] };
  }
  if (name === 'get_properties') return { type: 'object', properties: { status: { type: 'string', enum: ['active', 'archived', 'all'] }, market: { type: ['string', 'null'] }, propertyType: { type: ['string', 'null'] } } };
  if (name === 'get_portfolio_history') return { type: 'object', properties: { daysBack: { type: 'number' } } };
  if (name === 'get_latest_updates') return { type: 'object', properties: { date: { type: 'string' } } };
  if (name === 'run_screener') return { type: 'object', properties: { filtersJson: { type: 'string' } }, required: ['filtersJson'] };
  return { type: 'object', properties: {} };
}

async function callOpenAI(messages: OpenAIMessage[], tools: McpTool[]) {
  const openAiTools = tools
    .filter((tool) => tool.name)
    .map((tool) => ({
      type: 'function',
      function: {
        name: String(tool.name),
        description: String(tool.description || `LoftyAssist MCP tool ${tool.name}`).slice(0, 500),
        parameters: normalizeSchema(tool.inputSchema),
      },
    }));

  const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LLM_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://app.earlco.in',
      'X-Title': 'EarlCoin Compass Yield',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      max_tokens: 700,
      messages,
      tools: openAiTools,
      tool_choice: 'auto',
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

async function runCompassYieldAdvisor(messages: ChatMessage[], tools: McpTool[], sessionId: string) {
  if (!LLM_API_KEY) throw new Error('OPENAI_API_KEY or OPENROUTER_API_KEY is not configured for Compass Yield');

  const prompt = latestUserText(messages);
  const allowedTools = selectedMcpToolsForPrompt(prompt, tools);
  const openAiMessages: OpenAIMessage[] = [
    { role: 'system', content: COMPASS_YIELD_SYSTEM_PROMPT },
    ...chatMessagesForOpenAI(messages),
  ];

  let usedTools: string[] = [];
  for (let round = 0; round < 6; round += 1) {
    const completion = await callOpenAI(openAiMessages, allowedTools);
    const choice = completion?.choices?.[0]?.message;
    if (!choice) throw new Error('OpenAI returned no message');

    const assistantMessage: OpenAIMessage = {
      role: 'assistant',
      content: typeof choice.content === 'string' ? choice.content : null,
      tool_calls: Array.isArray(choice.tool_calls) ? choice.tool_calls : undefined,
    };
    openAiMessages.push(assistantMessage);

    const toolCalls = Array.isArray(choice.tool_calls) ? choice.tool_calls : [];
    if (!toolCalls.length) {
      return { answer: String(choice.content || '').trim(), usedTools };
    }

    for (const toolCall of toolCalls) {
      const toolName = String(toolCall?.function?.name || '');
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(String(toolCall?.function?.arguments || '{}'));
      } catch (_) {
        args = {};
      }

      if (!allowedTools.some((tool) => tool.name === toolName)) {
        openAiMessages.push({
          role: 'tool',
          tool_call_id: String(toolCall.id),
          content: `Tool ${toolName} is not available.`,
        });
        continue;
      }

      try {
        const result = await callTool(toolName, args, sessionId, 100 + round);
        usedTools.push(toolName);
        openAiMessages.push({
          role: 'tool',
          tool_call_id: String(toolCall.id),
          content: resultText(result).slice(0, 12000),
        });
      } catch (err) {
        openAiMessages.push({
          role: 'tool',
          tool_call_id: String(toolCall.id),
          content: `Tool error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }

  const final = await callOpenAI([
    ...openAiMessages,
    { role: 'user', content: 'Summarize the answer now using the data already gathered. Do not call more tools.' },
  ], []);
  return { answer: String(final?.choices?.[0]?.message?.content || '').trim(), usedTools };
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
    const tools = Array.isArray((listed.result as { tools?: unknown[] })?.tools) ? (listed.result as { tools: McpTool[] }).tools : [];
    const toolNames = tools.map((tool) => tool.name).filter(Boolean) as string[];

    if (agent === 'compass-yield' || agent === 'investment-advisor' || agent === 'lofty-assist-intel') {
      if (LLM_API_KEY) {
        const { answer, usedTools } = await runCompassYieldAdvisor(messages, tools, sessionId);
        return jsonResponse(200, { answer, tool: 'compass-yield', model: OPENAI_MODEL, usedTools, source: 'supabase-edge+openai+mcp-tools' });
      }
      const answer = await runInternalInvestmentAdvisor(prompt, messages, sessionId);
      return jsonResponse(200, { answer, tool: 'compass-yield-fallback', source: 'supabase-edge+mcp-tools' });
    }

    if (toolNames.includes(agent)) {
      const response = await mcpRequest('tools/call', {
        name: agent,
        arguments: { prompt, question: prompt, messages },
      }, 10, sessionId || undefined);
      return jsonResponse(200, { answer: resultText(response.result), tool: agent, source: 'supabase-edge' });
    }

    const answer = await runInternalInvestmentAdvisor(prompt, messages, sessionId);
    return jsonResponse(200, { answer, tool: 'lofty-assist-intel-fallback', source: 'supabase-edge+mcp-tools' });
  } catch (err) {
    return jsonResponse(502, { error: err instanceof Error ? err.message : String(err) });
  }
});
