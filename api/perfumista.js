import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Só permitir seu GitHub Pages (mais seguro)
const ALLOWED_ORIGIN = "https://vguerise.github.io";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

const SYSTEM_PROMPT = `
Você é "O Perfumista".

Formato obrigatório (bem objetivo):
- Título curto
- 3 recomendações numeradas (1, 2, 3)
- Para cada uma:
  • Nome do perfume
  • Família olfativa
  • Faixa de preço aproximada no Brasil
  • 1 linha: por que combina com o perfil
  • 1 linha: quando usar

Sem introdução longa. Sem enrolação.
`;

export default async function handler(req, res) {
  setCors(res);

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Use POST" });
    }

    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ error: "Campo 'prompt' é obrigatório." });
    }

    // ⚡ modelo rápido
    const response = await client.responses.create({
      model: "gpt-4.1-nano",
      temperature: 0.3,
      max_output_tokens: 520,
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt.trim() }
      ]
    });

    const text =
      response.output?.[0]?.content
        ?.filter((c) => c.type === "output_text")
        ?.map((c) => c.text)
        ?.join("") || "";

    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Erro desconhecido" });
  }
}
