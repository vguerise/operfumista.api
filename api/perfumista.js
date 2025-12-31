import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `
Você é "O Perfumista".
Tarefa: com base no texto do diagnóstico do usuário, gere recomendações objetivas.
Formato obrigatório:
- Título curto
- 3 recomendações numeradas (1,2,3)
- Para cada uma: nome | família | faixa de preço (se possível) | 1 linha de “por quê” | 1 linha “quando usar”
Sem enrolação. Sem introdução longa.
`;

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Use POST" });
      return;
    }

    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      res.status(400).json({ error: "Campo 'prompt' é obrigatório." });
      return;
    }

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt.trim() }
      ],
      temperature: 0.4,
      max_output_tokens: 650
    });

    // Extrai texto da resposta (Responses API)
    const text =
      response.output?.[0]?.content
        ?.filter((c) => c.type === "output_text")
        ?.map((c) => c.text)
        ?.join("") || "";

    res.status(200).json({ text });
  } catch (err) {
    // Rate limit / billing etc.
    const msg = err?.message || "Erro desconhecido";
    res.status(500).json({ error: msg });
  }
}
