export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing prompt" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "OPENAI_API_KEY not set on Vercel" });
    }

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5",
        input: [
          {
            role: "system",
            content:
              "Você é O Perfumista. Responda em PT-BR, objetivo e consultivo. " +
              "Leia o diagnóstico, identifique lacunas e recomende 3 perfumes disponíveis no Brasil, " +
              "com quando usar e justificativa curta."
          },
          { role: "user", content: prompt }
        ],
        store: false
      })
    });

    const data = await r.json();

    // Se a OpenAI devolveu erro, repassa direito
    if (!r.ok) {
      return res.status(r.status).json({
        error: data?.error?.message || "OpenAI error",
        details: data?.error || data
      });
    }

    // Extrai texto de forma robusta
    const text =
      (typeof data.output_text === "string" && data.output_text) ||
      (Array.isArray(data.output) &&
        data.output
          .flatMap(o => o?.content || [])
          .map(c => c?.text)
          .filter(Boolean)
          .join("\n")) ||
      "";

    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
