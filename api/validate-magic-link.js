import { DB } from "./lib/db.js";

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const allowedOrigins = [
    "https://vguerise.github.io",
    "https://mapadeperfumes.com.br",
    "http://localhost:3000"
  ];

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ valid: false, message: "Método não permitido" });

  try {
    const { token } = req.query;

    if (!token) return res.status(400).json({ valid: false, message: "Token não fornecido" });

    console.log(`🔍 Validando token: ${token}`);

    const { data, error } = await DB
      .from("entitlements")
      .select("email, magic_token_expires")
      .eq("magic_token", token)
      .eq("product_id", "hotmart")
      .eq("status", "active")
      .single();

    if (error || !data) {
      console.log("❌ Token não encontrado ou inativo");
      return res.status(200).json({ valid: false, message: "Link inválido ou expirado" });
    }

    if (new Date(data.magic_token_expires) < new Date()) {
      console.log(`⏰ Token expirado`);
      return res.status(200).json({ valid: false, message: "Link expirado. Por favor, faça login com seu email." });
    }

    console.log(`✅ Token válido para: ${data.email}`);
    return res.status(200).json({ valid: true, email: data.email, message: "Acesso liberado!" });

  } catch (err) {
    console.error("❌ Erro ao validar token:", err);
    return res.status(500).json({ valid: false, message: "Erro interno ao validar link" });
  }
}
