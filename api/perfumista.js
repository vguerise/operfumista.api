import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Ajuste aqui se você quiser permitir também o Tiny.site etc.
const ALLOWED_ORIGINS = new Set([
  "https://vguerise.github.io",
  "https://vguerise.github.io/operfumista",
  "https://vguerise.github.io/operfumista/",
]);

function setCors(req, res) {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    // fallback seguro (evita estourar CORS em alguns testes)
    res.setHeader("Access-Control-Allow-Origin", "https://vguerise.github.io");
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

export default async function handler(req, res) {
  setCors(req, res);

  // Preflight (CORS)
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST." });
  }

  try {
    const { diagnostico } = req.body || {};
    if (!diagnostico || !String(diagnostico).trim()) {
      return res.status(400).json({ error: "Campo 'diagnostico' vazio." });
    }

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        titulo: { type: "string" },
        subtitulo: { type: "string" },
        recomendacoes: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              nome: { type: "string" },
              familia: { type: "string" },
              faixa_preco: { type: "string" },
              por_que: { type: "string" },
              quando_usar: { type: "string" }
            },
            required: ["nome", "familia", "faixa_preco", "por_que", "quando_usar"]
          }
        }
      },
      required: ["titulo", "subtitulo", "recomendacoes"]
    };

    // Modelo rápido: gpt-4.1-mini :contentReference[oaicite:1]{index=1}
    const resp = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.6,
      response_format: {
        type: "json_schema",
        json_schema: { name: "perfumista_cards", schema, strict: true }
      },
      messages: [
        {
          role: "system",
          content:
            "Você é O Perfumista. Gere exatamente 3 recomendações EM JSON, no schema fornecido. " +
            "Seja direto, prático e coerente com clima, ambiente e orçamento. " +
            "Não use markdown, não use texto fora do JSON."
        },
        {
          role: "user",
          content: String(diagnostico)
        }
      ]
    });

    const content = resp?.choices?.[0]?.message?.content || "{}";
    let json;

    try {
      json = JSON.parse(content);
    } catch {
      // Se por algum motivo vier algo fora do JSON, ainda devolve algo utilizável
      json = {
        titulo: "🎁 3 RECOMENDAÇÕES PARA EQUILIBRAR SUA COLEÇÃO",
        subtitulo: "Baseado no seu contexto e lacunas identificadas.",
        recomendacoes: [],
        raw: content
      };
    }

    return res.status(200).json(json);
  } catch (err) {
    return res.status(500).json({
      error: err?.message || "Erro interno."
    });
  }
}
