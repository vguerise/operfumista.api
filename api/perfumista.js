// /api/perfumista.js (Vercel)
// Node 18+ (fetch disponível)

const ALLOWED_ORIGINS = [
  "https://vguerise.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:5500",
];

function setCors(res, origin) {
  // Para começar sem dor de cabeça, liberamos tudo:
  // (Se quiser travar depois, basta trocar "*" pela origem validada)
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function pickOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return "*";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  return "*";
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const origin = pickOrigin(req);
  setCors(res, origin);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res
      .status(500)
      .json({ error: "OPENAI_API_KEY não configurada no Vercel." });
  }

  const { diagnostico } = req.body || {};
  const text = typeof diagnostico === "string" ? diagnostico.trim() : "";

  if (!text) {
    return res.status(400).json({ error: "Campo 'diagnostico' vazio." });
  }

  // Prompt: devolve JSON fixo (para o front renderizar em cards)
  const instructions = `
Você é O Perfumista (consultor de perfumaria masculina).
Saída: RESPONDA APENAS EM JSON válido (sem markdown, sem texto extra).
Formato:
{
  "titulo": "🎁 3 RECOMENDAÇÕES PARA EQUILIBRAR SUA COLEÇÃO",
  "subtitulo": "Baseado no seu contexto e lacunas identificadas.",
  "recomendacoes": [
    {
      "nome": "Nome do perfume",
      "familia": "Família olfativa (ex: Fresco/Cítrico, Aquático, Amadeirado, Doce/Gourmand, Especiado/Oriental, etc.)",
      "faixa_preco": "Faixa em R$ (ex: R$ 350–550)",
      "por_que": "1–2 frases objetivas do porquê encaixa no perfil e no que falta",
      "quando_usar": "Situações ideais (clima/ambiente/ocasião)"
    }
  ],
  "pergunta_extra": "Quer mais alguma sugestão? Digite a situação, clima, ambiente e orçamento!"
}
Regras:
- Exatamente 3 itens em "recomendacoes".
- Seja prático, sem enrolação, e considere clima e ambiente citados.
- Se faltar alguma info no texto, assuma de forma conservadora e siga.
`.trim();

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        instructions,
        input: text,
        temperature: 0.6,
        max_output_tokens: 550,
        store: false,
      }),
    });

    const raw = await r.text();

    if (!r.ok) {
      return res.status(r.status).json({ error: `OpenAI: ${raw}` });
    }

    const payload = safeJsonParse(raw);

    const outputText =
      payload?.output
        ?.find((o) => o.type === "message")
        ?.content?.find((c) => c.type === "output_text")?.text ||
      payload?.output_text ||
      "";

    const json = safeJsonParse(outputText.trim());

    if (!json) {
      // fallback (não quebra o front)
      return res.status(200).json({
        titulo: "Resposta do Perfumista",
        subtitulo: "Não consegui estruturar em JSON — retornando texto.",
        recomendacoes: [],
        raw: outputText.trim(),
      });
    }

    return res.status(200).json(json);
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
