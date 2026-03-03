// POST /api/push-send-missao
// Chamado pelo Vercel Cron toda segunda-feira às 9h (horário de Brasília = 12h UTC)
// Gera missão via Claude e dispara push para todos os inscritos

import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import Anthropic from '@anthropic-ai/sdk';

const DB = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

webpush.setVapidDetails(
  'mailto:vguerise@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  // Segurança: só aceita chamadas do próprio Vercel Cron ou com token correto
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Buscar todos os inscritos com subscription ativa
    const { data: inscritos, error } = await DB
      .from('push_subscriptions')
      .select('user_id, subscription');

    if (error) throw error;
    if (!inscritos || !inscritos.length) {
      return res.status(200).json({ ok: true, enviados: 0 });
    }

    // 2. Gerar missão genérica da semana via Claude
    //    (missão personalizada é gerada no app — aqui é a notificação de lembrete)
    const semana = getNumeroSemana();
    const msg = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 150,
      system: 'Voce e o Perfumista. Responda APENAS com um objeto JSON.',
      messages: [{
        role: 'user',
        content: `Crie uma missao olfativa inspiradora para a semana ${semana} do ano. Frase curta de acao (max 60 chars), sem mencionar marcas especificas. Responda APENAS: {"titulo":"frase aqui"}`
      }]
    });

    const txt = msg.content[0].text.replace(/```json|```/g, '').trim();
    const { titulo } = JSON.parse(txt);

    // 3. Disparar push para todos os inscritos
    let enviados = 0;
    let erros = 0;
    const mortos = []; // subscriptions inválidas para remover

    const payload = JSON.stringify({
      title: '🎯 Missão da Semana — Perfumap',
      body: titulo,
      icon: '/perfumap/icon-192.png',
      badge: '/perfumap/icon-192.png',
      url: '/perfumap/',
      tag: 'missao-semanal'
    });

    await Promise.allSettled(
      inscritos.map(async ({ user_id, subscription }) => {
        try {
          await webpush.sendNotification(JSON.parse(subscription), payload);
          enviados++;
        } catch (err) {
          erros++;
          // 410 Gone = subscription expirada/removida pelo navegador
          if (err.statusCode === 410 || err.statusCode === 404) {
            mortos.push(user_id);
          }
          console.error(`[push] user ${user_id}:`, err.message);
        }
      })
    );

    // 4. Limpar subscriptions mortas
    if (mortos.length) {
      await DB.from('push_subscriptions').delete().in('user_id', mortos);
      console.log(`[push] ${mortos.length} subscriptions expiradas removidas`);
    }

    console.log(`[push] enviados: ${enviados}, erros: ${erros}`);
    return res.status(200).json({ ok: true, enviados, erros });

  } catch (err) {
    console.error('[push-send-missao]', err);
    return res.status(500).json({ error: err.message });
  }
}

function getNumeroSemana() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
}
