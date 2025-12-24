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

  const { measurement_id } = req.query;

  if (!measurement_id || typeof measurement_id !== "string") {
    return res.status(400).json({ error: "measurement_id inválido" });
  }

  try {
    const response = await fetch(
      `https://api.globalping.io/v1/measurements/${measurement_id}`
    );

    if (!response.ok) {
      return res.status(500).json({
        error: "Falha ao consultar medição Globalping"
      });
    }

    const data = await response.json();

    const probes = (data.results || []).map((r: any) => ({
      continente: r.probe?.continent || "N/A",
      pais: r.probe?.country || "N/A",
      cidade: r.probe?.city || "N/A",
      isp: r.probe?.asn_name || "Desconhecido",
      status: r.result?.status || "unknown",
      rtt_ms: r.result?.rtt || null
    }));

    return res.status(200).json({
      measurement_id,
      status: data.status,
      probes
    });

  } catch (err) {
    return res.status(500).json({
      error: "Erro interno ao consultar Globalping"
    });
  }
}
