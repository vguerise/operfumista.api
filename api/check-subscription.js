import { DB } from "./lib/db.js";

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const allowedOrigins = [
    "https://vguerise.github.io",
    "https://mapadeperfumes.com.br",
    "http://localhost:3000",
    "http://127.0.0.1:5500"
  ];

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ isPro: false, error: "Método não permitido" });

  try {
    const { email } = req.query;

    if (!email) return res.status(400).json({ isPro: false, error: "Email não fornecido" });

    console.log(`🔍 Verificando assinatura para: ${email}`);

    if (email.toLowerCase() === process.env.VIP_EMAIL || email.toLowerCase() === "vguerise@gmail.com") {
      console.log("👑 VIP detectado!");
      return res.status(200).json({ isPro: true, email, vip: true });
    }

    const { data, error } = await DB
      .from("usuarios_curso")
      .select("product_id, created_at")
      .eq("email", email.toLowerCase())
      .eq("status", "ativo")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("❌ Erro Supabase:", error);
      return res.status(500).json({ isPro: false, error: "Erro ao verificar assinatura" });
    }

    if (data && data.length > 0) {
      console.log("✅ Assinatura ativa encontrada!");
      return res.status(200).json({ isPro: true, email, activatedAt: data[0].created_at, productId: data[0].product_id });
    }

    console.log(`❌ Nenhuma assinatura ativa para: ${email}`);
    return res.status(200).json({ isPro: false, email, message: "Assinatura não encontrada" });

  } catch (err) {
    console.error("❌ Erro geral:", err);
    return res.status(500).json({ isPro: false, error: "Erro interno" });
  }
}
