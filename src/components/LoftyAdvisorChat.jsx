import React, { useMemo, useState } from 'react';
import { Bot, Loader2, Send, Sparkles, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';

const starterPrompts = [
  'Which Lofty deals have the best risk-adjusted cashflow right now?',
  'Compare the top equity alpha opportunities against LP strategy yield.',
  'What would you avoid buying and why?',
];

const buildMessagesPayload = (messages, prompt) => ([
  ...messages.map(({ role, content }) => ({ role, content })),
  { role: 'user', content: prompt },
]);

const LoftyAdvisorChat = ({ className }) => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Ask me about Lofty deals, cashflow, alpha, LP strategy, or portfolio fit. I route to LoftyAssist MCP and EarlCoin deal intelligence.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  const sendPrompt = async (promptText = input) => {
    const prompt = promptText.trim();
    if (!prompt || loading) return;

    const nextMessages = [...messages, { role: 'user', content: prompt }];
    setMessages(nextMessages);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      const intelPayload = {
        agent: 'lofty-assist-intel',
        messages: buildMessagesPayload(messages, prompt),
      };

      let payload = null;
      let intelError = null;

      const { data, error: edgeError } = await supabase.functions.invoke('lofty-advisor-chat', {
        body: intelPayload,
      });

      if (!edgeError && data?.answer) {
        payload = data;
      } else {
        intelError = edgeError?.message || data?.error || null;
        const res = await fetch('/api/lofty-chat.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(intelPayload),
        });
        const fallbackPayload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(fallbackPayload?.error || intelError || `Lofty Assist Intel unavailable (${res.status})`);
        }
        payload = fallbackPayload;
      }

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: payload?.answer || 'I did not get a usable answer from Lofty Assist Intel.',
        },
      ]);
    } catch (err) {
      const msg = err?.message || 'Advisor request failed';
      setError(msg);
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: `I could not reach Lofty Assist Intel yet: ${msg}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={cn('border-primary/20 bg-card/70 backdrop-blur', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          Lofty Assist Intel
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Powered by LoftyAssist MCP. Outputs are research support, not financial advice.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border border-border/40 bg-background/30 p-3">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={cn('flex gap-2', message.role === 'user' ? 'justify-end' : 'justify-start')}>
              {message.role !== 'user' && <Bot className="mt-1 h-4 w-4 shrink-0 text-primary" />}
              <div className={cn(
                'max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm',
                message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary/70 text-foreground',
              )}>
                {message.content}
              </div>
              {message.role === 'user' && <User className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Advisor is thinking…
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {starterPrompts.map((prompt) => (
            <Button key={prompt} type="button" variant="outline" size="sm" onClick={() => sendPrompt(prompt)} disabled={loading}>
              {prompt}
            </Button>
          ))}
        </div>

        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendPrompt();
            }}
            placeholder="Ask Lofty Assist Intel about a property, yield, alpha, risk, or portfolio allocation…"
            className="min-h-[72px]"
          />
          <Button onClick={() => sendPrompt()} disabled={!canSend} className="self-end">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
};

export default LoftyAdvisorChat;
