/// <reference lib="deno.ns" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.12.0';
import { corsHeaders } from './cors.ts';

const PROJECT_URL = Deno.env.get('PROJECT_URL') ?? '';
const PROJECT_SECRET_KEY = Deno.env.get('PROJECT_SECRET_KEY') ?? '';
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!PROJECT_URL || !PROJECT_SECRET_KEY || !STRIPE_SECRET_KEY) {
      return jsonResponse(500, { error: 'Missing required secrets' });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) {
      return jsonResponse(401, { error: 'Missing Authorization header' });
    }

    const supabase = createClient(PROJECT_URL, PROJECT_SECRET_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) {
      return jsonResponse(401, { error: authErr?.message ?? 'Unauthorized' });
    }

    const body = await req.json().catch(() => ({}));
    const requestedUserId = typeof body?.user_id === 'string' ? body.user_id : null;
    if (requestedUserId && requestedUserId !== authData.user.id) {
      return jsonResponse(403, { error: 'user_id does not match authenticated user' });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const verificationSession = await stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: {
        user_id: authData.user.id,
      },
    });

    return jsonResponse(200, {
      client_secret: verificationSession.client_secret,
      session_id: verificationSession.id,
      status: verificationSession.status,
    });
  } catch (error) {
    return jsonResponse(400, { error: error?.message ?? 'Unknown error' });
  }
});
