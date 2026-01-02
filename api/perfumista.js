import OpenAI from "openai";

/**
 * Vercel Serverless Function (Node)
 * Endpoint: /api/perfumista
 *
 * Entrada esperada (POST JSON):
 * {
 *   "prompt": "texto do diagnóstico do mapa pai (coleção, orçamento, ambiente etc)",
 *   "extra": "opcional: pedido adicional do usuário"
 * }
 *
 * Saída:
 * {
 *   "text": "linha1\nlinha2\nlinha3",
 *   "top3": ["linha1","linha2","linha3"]
 * }
 */

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Ajuste aqui seus domínios permitidos (CORS)
const ALLOWED_ORIGINS = new Set([
  "https://vguerise.github.io",
  // "https://seu-dominio.com",
]);

function setCors(req, res) {
  const origin = req.headers.origin;

  // Se não houver origin (curl/postman) libera
  if (!origin) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function normalizeLines(text) {
  const lines = String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  // Se o modelo devolver bullets/números, remove prefixos comuns
  const cleaned = lines.map(l =>
    l.replace(/^[-*•]\s*/, "").replace(/^\d+\s*[\).\-\:]\s*/, "").trim()
  );

  // Garante 3 linhas. Se vier mais, corta. Se vier menos, preenche com placeholder.
  const top3 = cleaned.slice(0, 3);
  while (top3.length < 3) top3.push("Sugestão indisponível — Ajuste seu pedido e tente novamente.");
  return top3;
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido. Use POST." });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const prompt = (body.prompt || "").toString().trim();
    const extra = (body.extra || "").toString().trim();

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY não configurada no servidor." });
    }

    if (!prompt) {
      return res.status(400).json({ error: "Campo 'prompt' é obrigatório." });
    }

    const system = [
      "Você é o Perfumista (motor do 'Mapa da Coleção Perfeita').",
      "Seu trabalho: analisar a coleção informada pelo usuário + clima + ambiente de trabalho + orçamento.",
      "Objetivo: sugerir 3 perfumes (TOP 3) que EQUILIBREM a coleção, priorizando famílias menos representadas e adequação ao contexto.",
      "",
      "REGRAS DE SAÍDA (obrigatório):",
      "1) Responda APENAS com 3 linhas, uma por recomendação. Nada além.",
      "2) Cada linha deve seguir exatamente este formato:",
      "   Nome do perfume | Família | Faixa de preço (R$ xxx–yyy) | 6 a 12 palavras de justificativa",
      "3) Não use bullets, não use numeração, não use parágrafos extras.",
      "4) Se faltar informação, faça a melhor inferência sem perguntar.",
      "",
      "Critérios:",
      "- Se o ambiente for fechado/escritório: evitar bombas extremamente invasivas; priorizar elegância e controle.",
      "- Se o clima for quente: evitar perfumes muito densos/doce pesado (a menos que pedido).",
      "- Use alternativas disponíveis no Brasil (designer + nicho acessível), dentro do orçamento quando possível.",
    ].join("\n");

    const user = [
      "DADOS DO MAPA PAI:",
      prompt,
      extra ? `\nPEDIDO EXTRA DO USUÁRIO:\n${extra}` : "",
    ].join("\n");

    // Observação: escolha do modelo — você pode trocar por outro disponível no seu plano.
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.7,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const rawText = completion?.choices?.[0]?.message?.content ?? "";
    const top3 = normalizeLines(rawText);
    const text = top3.join("\n");

    return res.status(200).json({ text, top3, raw: rawText });

  } catch (err) {
    const status = err?.status || 500;
    const msg = err?.message || "Erro desconhecido";
    return res.status(status).json({ error: msg });
  }
}
