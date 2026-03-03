// POST /api/push-subscribe
// Salva a subscription de push do usuário no Supabase
import { createClient } from '@supabase/supabase-js';

const DB = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // service_role key — só no servidor
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { subscription, user_id } = req.body;

  if (!subscription || !user_id) {
    return res.status(400).json({ error: 'subscription e user_id obrigatorios' });
  }

  try {
    const { error } = await DB.from('push_subscriptions').upsert(
      {
        user_id,
        subscription: JSON.stringify(subscription),
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id' }
    );

    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[push-subscribe]', err);
    return res.status(500).json({ error: err.message });
  }
}
