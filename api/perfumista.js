export default async function handler(req, res) {
  // Permite que seu site do GitHub Pages chame esta API
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { prompt } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5",
        input: [
          {
            role: "system",
            content:
              "Você é O Perfumista. Analise o diagnóstico do usuário, identifique lacunas e " +
              "recomende 3 perfumes disponíveis no Brasil, explicando quando usar cada um."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    const data = await response.json();
    return res.status(200).json({ text: data.output_text });

  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
