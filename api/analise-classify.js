export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowed = (origin.includes('vguerise.com.br') || origin.includes('vguerise.github.io'))
    ? origin : 'https://vguerise.com.br';
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-analise-token');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.headers['x-analise-token'];
  if (!token || token !== process.env.ANALISE_TOKEN) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }

  const { messages, max_tokens, model } = req.body || {};
  if (!messages?.length) return res.status(400).json({ error: 'messages obrigatório.' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-6',
        max_tokens: max_tokens || 2500,
        messages,
      }),
    });
    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}