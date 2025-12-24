import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // 🔓 CORS (OBRIGATÓRIO)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { id } = req.query;

    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Measurement ID inválido" });
    }

    const response = await fetch(
      `https://api.globalping.io/v1/measurements/${id}`
    );

    if (!response.ok) {
      return res.status(500).json({
        error: "Erro ao consultar Globalping"
      });
    }

    const data = await response.json();

    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({
      error: "Erro interno ao buscar resultado Globalping"
    });
  }
}
