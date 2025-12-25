import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // 🔓 CORS — OBRIGATÓRIO PARA FRONTEND
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ⚠️ Preflight (CORS)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 🚫 Bloqueia métodos inválidos
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { dominio } = req.body;

    if (!dominio) {
      return res.status(400).json({ error: "Domínio não informado" });
    }

    // 🔎 DNS (simples)
    const dns = [];

    // 🔌 TCP (simulado por enquanto)
    const tcp = {
      status: "online",
      port: 443,
      latency_ms: Math.floor(Math.random() * 10) + 5,
    };

    // 🌍 Globalping (mock / real se você já tem)
    const globalping = {
      measurement_id: "gerado-pelo-backend",
      probes: [],
    };

    return res.status(200).json({
      dominio,
      status: "ok",
      origem: "vercel-serverless",
      dns,
      tcp,
      globalping,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({
      error: "Erro interno ao executar diagnóstico",
    });
  }
}
