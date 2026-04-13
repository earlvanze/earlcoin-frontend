/// <reference lib="deno.ns" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from 'https://esm.sh/stripe@14.12.0';
import { corsHeaders } from './cors.ts';

const PROJECT_URL = Deno.env.get('PROJECT_URL') ?? '';
const PROJECT_SECRET_KEY = Deno.env.get('PROJECT_SECRET_KEY') ?? '';
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient()
});

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
    if (!authHeader) return jsonResponse(401, { error: 'Missing Authorization header' });

    const supabase = createClient(PROJECT_URL, PROJECT_SECRET_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) {
      return jsonResponse(401, { error: authErr?.message ?? 'Unauthorized' });
    }

    const body = await req.json();
    const sessionId = body?.session_id;
    if (!sessionId) return jsonResponse(400, { error: 'session_id required' });

    const session = await stripe.identity.verificationSessions.retrieve(sessionId);

    // Verify the session belongs to the authenticated user to prevent
    // using another user's verified session to mark your own account as KYC'd.
    if (session?.metadata?.user_id && session.metadata.user_id !== authData.user.id) {
      return jsonResponse(403, { error: 'Verification session does not belong to this user' });
    }

    if (session?.status === 'verified') {
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: authData.user.id, kyc_verified: true, updated_at: new Date().toISOString() })
        .eq('id', authData.user.id);
      if (error) return jsonResponse(500, { error: error.message });
    }

    return jsonResponse(200, { status: session?.status, session_id: session?.id });
  } catch (e) {
    return jsonResponse(500, { error: e?.message ?? 'Unknown error' });
  }
});
