import type { VercelRequest, VercelResponse } from "@vercel/node";
import dns from "dns/promises";
import net from "net";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // 🔓 CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { dominio } = req.body;

  if (!dominio) {
    return res.status(400).json({ error: "Domínio não informado" });
  }

  try {
    const records: any[] = [];

    try {
      const a = await dns.resolve4(dominio, { ttl: true });
      a.forEach((r: any) =>
        records.push({ type: "A", address: r.address, ttl: r.ttl })
      );
    } catch {}

    try {
      const aaaa = await dns.resolve6(dominio, { ttl: true });
      aaaa.forEach((r: any) =>
        records.push({ type: "AAAA", address: r.address, ttl: r.ttl })
      );
    } catch {}

    try {
      const ns = await dns.resolveNs(dominio);
      ns.forEach((n) => records.push({ type: "NS", value: n }));
    } catch {}

    const tcp = await new Promise((resolve) => {
      const start = Date.now();
      const socket = net.createConnection(443, dominio);

      socket.setTimeout(3000);

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
        resolve({ status: "timeout", port: 443, latency_ms: null });
      });
    });

    // 🔹 Aqui você já integra o Globalping como já estava funcionando
    const globalping = {
      measurement_id: "gerado-pelo-backend",
      probes: [],
    };

    return res.status(200).json({
      dominio,
      status: "ok",
      origem: "vercel-serverless",
      dns: records,
      tcp,
      globalping,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: "Erro interno" });
  }
}
