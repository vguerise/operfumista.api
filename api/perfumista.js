import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// >>> AJUSTE AQUI se quiser liberar mais origens
const ALLOWED_ORIGINS = new Set([
  "https://vguerise.github.io",
  // Se você tiver um domínio próprio, adicione aqui depois
  // "https://seu-dominio.com",
]);

function setCors(req, res) {
  const origin = req.headers.origin;

  // Se o request vier do seu GitHub Pages, libera.
  // Se não tiver origin (ex: curl/postman), libera também.
  if (!origin) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    // Bloqueia por padrão (mais seguro). Se quiser liberar geral:
    // res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

const SYSTEM_PROMPT = `
Você é "O Perfumista".
Objetivo: transformar o diagnóstico do usuário em 3 recomendações úteis e diretas para equilibrar a coleção.
Regras:
- Sem texto longo.
- Sem “aqui vão” / sem introdução.
- Foque em clima + ambiente (aberto/fechado) + orçamento + lacunas.
- Use nomes reais de perfumes (disponíveis no Brasil, quando possível).
- Se faltar informação (ex: orçamento), assuma uma faixa comum e sinalize rápido.

Você DEVE responder APENAS com um JSON válido no formato abaixo (sem markdown, sem crases):

{
  "titulo": "3 recomendações para equilibrar sua coleção",
  "subtitulo": "Baseado no seu diagnóstico e lacunas identificadas.",
  "recomendacoes": [
    {
      "nome": "Nome do perfume",
      "familia": "Fresco/Cítrico | Amadeirado | Doce/Gourmand | Especiado/Oriental | Aquático | Aromático/Verde | Floral | Frutado | Talco/Fougère",
      "faixa_preco": "R$ 400–550",
      "por_que": "1 frase objetiva dizendo por que entra na coleção",
      "quando_usar": "1 frase objetiva (situações + clima/ambiente)"
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
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const diagnostico = (body?.diagnostico || "").toString().trim();

    if (!diagnostico) {
      return res.status(400).json({ error: "Campo 'diagnostico' vazio." });
    }

    // Proteção simples: limita tamanho (evita custos e travas)
    const diagnosticoCortado =
      diagnostico.length > 6000 ? diagnostico.slice(0, 6000) : diagnostico;

    // Respostas API (recomendado no docs) :contentReference[oaicite:1]{index=1}
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: diagnosticoCortado },
      ],
      // Dica: baixa latência e custo previsível
      max_output_tokens: 700,
    });

    // Extrai texto da Responses API
    const text =
      response.output
        ?.flatMap((o) => o.content || [])
        ?.filter((c) => c.type === "output_text")
        ?.map((c) => c.text)
        ?.join("") || "";

    // Tenta parsear JSON
    let data = null;
    try {
      data = JSON.parse(text);
    } catch (e) {
      // Fallback: se o modelo cuspir texto fora do JSON, devolve cru
      data = {
        titulo: "Resposta do Perfumista",
        subtitulo: "Não foi possível formatar em cards automaticamente.",
        recomendacoes: [],
        pergunta_extra:
          "Quer mais alguma sugestão? Digite a situação, clima, ambiente e orçamento!",
        raw: text,
      };
    }

    return res.status(200).json(data);
  } catch (err) {
    const status = err?.status || 500;
    const msg = err?.message || "Erro desconhecido";
    return res.status(status).json({ error: msg });
  }
}
