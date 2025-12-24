import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // 🔓 CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "measurement_id inválido" });
  }

  try {
    const response = await fetch(
      `https://api.globalping.io/v1/measurements/${id}`
    );

    if (!response.ok) {
      return res.status(500).json({
        error: "Falha ao consultar Globalping"
      });
    }

    const data = await response.json();

    return res.status(200).json({
      measurement_id: id,
      status: data.status,
      probes: data.results || []
    });
  } catch {
    return res.status(500).json({
      error: "Erro interno ao consultar Globalping"
    });
  }
}
