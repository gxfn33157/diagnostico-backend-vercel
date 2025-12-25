import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // =========================
  // 🔓 CORS (OBRIGATÓRIO)
  // =========================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { id } = req.query;

    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "ID inválido" });
    }

    const response = await fetch(
      `https://api.globalping.io/v1/measurements/${id}`
    );

    const data = await response.json();

    if (!data || !data.results) {
      return res.status(200).json({
        status: data?.status ?? "unknown",
        target: data?.target ?? null,
        summary: [],
      });
    }

    const summary = data.results.map((r: any) => ({
      continente: r.probe?.continent ?? "N/A",
      pais: r.probe?.country ?? "N/A",
      cidade: r.probe?.city ?? "N/A",
      isp: r.probe?.asn_name ?? "N/A",
      status: r.result?.status ?? "unknown",
      rtt_ms: r.result?.rtt ?? null,
    }));

    return res.status(200).json({
      target: data.target,
      status: data.status,
      summary,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Erro ao consultar GlobalPing",
    });
  }
}
