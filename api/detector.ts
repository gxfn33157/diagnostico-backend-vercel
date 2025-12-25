import type { VercelRequest, VercelResponse } from "@vercel/node";
import dns from "dns/promises";
import net from "net";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // =========================
  // 🔓 CORS (OBRIGATÓRIO)
  // =========================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { dominio } = req.body;

    if (!dominio) {
      return res.status(400).json({ error: "Domínio não informado" });
    }

    // =========================
    // DNS
    // =========================
    const dnsRecords: any[] = [];

    try {
      const aRecords = await dns.resolve4(dominio, { ttl: true });
      aRecords.forEach((r) =>
        dnsRecords.push({ type: "A", address: r.address, ttl: r.ttl })
      );
    } catch {}

    try {
      const aaaaRecords = await dns.resolve6(dominio, { ttl: true });
      aaaaRecords.forEach((r) =>
        dnsRecords.push({ type: "AAAA", address: r.address, ttl: r.ttl })
      );
    } catch {}

    try {
      const nsRecords = await dns.resolveNs(dominio);
      nsRecords.forEach((r) =>
        dnsRecords.push({ type: "NS", value: r })
      );
    } catch {}

    // =========================
    // TCP 443
    // =========================
    const tcpResult = await new Promise<any>((resolve) => {
      const start = Date.now();
      const socket = net.createConnection(443, dominio);

      socket.setTimeout(5000);

      socket.on("connect", () => {
        const latency = Date.now() - start;
        socket.destroy();
        resolve({ status: "online", port: 443, latency_ms: latency });
      });

      socket.on("error", () => {
        resolve({ status: "offline", port: 443, latency_ms: null });
      });

      socket.on("timeout", () => {
        socket.destroy();
        resolve({ status: "offline", port: 443, latency_ms: null });
      });
    });

    // =========================
    // GLOBALPING (cria medição)
    // =========================
    let globalpingMeasurementId: string | null = null;

    try {
      const gpRes = await fetch("https://api.globalping.io/v1/measurements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target: dominio,
          type: "ping",
          limit: 15,
        }),
      });

      const gpData = await gpRes.json();
      globalpingMeasurementId = gpData?.id ?? null;
    } catch {}

    // =========================
    // RESPOSTA FINAL
    // =========================
    return res.status(200).json({
      dominio,
      status: "ok",
      origem: "vercel-serverless",
      dns: dnsRecords,
      tcp: tcpResult,
      globalping: globalpingMeasurementId
        ? { measurement_id: globalpingMeasurementId, probes: [] }
        : null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      error: "Erro interno ao executar diagnóstico",
    });
  }
}
