import type { VercelRequest, VercelResponse } from "@vercel/node";
import dns from "dns/promises";
import net from "net";

/**
 * Teste TCP real (porta 443 por padrão)
 */
async function tcpTest(
  host: string,
  port = 443,
  timeout = 3000
): Promise<{
  status: "online" | "offline" | "timeout";
  port: number;
  latency_ms?: number;
}> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();

    socket.setTimeout(timeout);

    socket.connect(port, host, () => {
      const latency = Date.now() - start;
      socket.destroy();
      resolve({
        status: "online",
        port,
        latency_ms: latency
      });
    });

    socket.on("error", () => {
      socket.destroy();
      resolve({
        status: "offline",
        port
      });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({
        status: "timeout",
        port
      });
    });
  });
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // 🔓 CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    const { dominio } = req.body || {};

    if (!dominio || typeof dominio !== "string") {
      return res.status(400).json({ error: "Domínio inválido" });
    }

    /**
     * 🌐 DNS LOOKUP COMPLETO
     */
    let dnsResult: any[] | { error: string };

    try {
      const records = await dns.resolveAny(dominio);
      dnsResult = records.map((r: any) => {
        if (r.address) {
          return {
            type: r.type,
            address: r.address,
            ttl: r.ttl
          };
        }

        if (r.exchange) {
          return {
            type: "MX",
            exchange: r.exchange,
            priority: r.priority
          };
        }

        if (r.value) {
          return {
            type: r.type,
            value: r.value
          };
        }

        return r;
      });
    } catch {
      dnsResult = { error: "Falha ao resolver DNS" };
    }

    /**
     * 📡 TCP TEST (443)
     */
    const tcpResult = await tcpTest(dominio);

    /**
     * ✅ RESPOSTA FINAL
     */
    return res.status(200).json({
      dominio,
      status: "ok",
      origem: "vercel-serverless",
      dns: dnsResult,
      tcp: tcpResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return res.status(500).json({
      error: "Erro interno no diagnóstico"
    });
  }
}
