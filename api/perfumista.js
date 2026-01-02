import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Domínios que podem chamar a API
const ALLOWED_ORIGINS = new Set([
  "https://vguerise.github.io",
]);

function setCors(req, res) {
  const origin = req.headers.origin;

  if (!origin) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

const SYSTEM_PROMPT = `
Você é "O Perfumista".
Objetivo: transformar o diagnóstico do usuário em 3 recomendações úteis e diretas para equilibrar a coleção.

REGRAS:
- Sem introdução longa.
- Responda sempre com 3 recomendações.
- Cada recomendação deve ter: nome, família, faixa_preco, por_que, quando_usar.
- Use perfumes reais (preferência: disponíveis no Brasil).
- Foque em clima + ambiente (aberto/fechado) + orçamento + lacunas.

SAÍDA:
Você DEVE responder APENAS com JSON válido (sem markdown, sem crases):

{
  "titulo": "3 recomendações para equilibrar sua coleção",
  "subtitulo": "Baseado no seu diagnóstico e lacunas identificadas.",
  "recomendacoes": [
    {
      "nome": "Nome do perfume",
      "familia": "Fresco/Cítrico | Amadeirado | Doce/Gourmand | Especiado/Oriental | Aquático | Aromático/Verde | Floral | Frutado | Talco/Fougère",
      "faixa_preco": "R$ 400–550",
      "por_que": "1 frase objetiva",
      "quando_usar": "1 frase objetiva"
    }
  ],
  "pergunta_extra": "Quer mais alguma sugestão? Digite a situação, clima, ambiente e orçamento!"
}
`;

export default async function handler(req, res) {
  setCors(req, res);

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  try {
    // Parse defensivo (Vercel às vezes manda string)
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : (req.body || {});

    // Compatibilidade total com fronts antigos e novos
    const incoming =
      (body.diagnostico ?? body.prompt ?? body.text ?? "").toString().trim();

    if (!incoming) {
      return res.status(400).json({ error: "Campo 'diagnostico' vazio." });
    }

    const diagnostico =
      incoming.length > 6000 ? incoming.slice(0, 6000) : incoming;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: diagnostico },
      ],
      max_output_tokens: 450,
    });

    const text =
      response.output
        ?.flatMap(o => o.content || [])
        ?.filter(c => c.type === "output_text")
        ?.map(c => c.text)
        ?.join("") || "";

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      // fallback se o modelo sair do formato
      data = {
        titulo: "Resposta do Perfumista",
        subtitulo: "Não foi possível formatar em cards automaticamente.",
        recomendacoes: [],
        pergunta_extra:
          "Quer mais alguma sugestão? Digite a situação, clima, ambiente e orçamento!",
        raw: text,
      };
    }

    // também devolve "text" para compatibilidade com fronts antigos
    return res.status(200).json({ ...data, text });

  } catch (err) {
    const status = err?.status || 500;
    const msg = err?.message || "Erro desconhecido";
    return res.status(status).json({ error: msg });
  }
}
