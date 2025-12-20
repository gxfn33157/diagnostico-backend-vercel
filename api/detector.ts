import type { VercelRequest, VercelResponse } from "@vercel/node";
import dns from "dns/promises";

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

  try {
    // Método
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    // Body
    const { dominio } = req.body || {};

    if (!dominio || typeof dominio !== "string") {
      return res.status(400).json({ error: "Domínio inválido" });
    }

    // 🌐 DNS Lookup
    let dnsResult: any;
    try {
      dnsResult = await dns.resolveAny(dominio);
    } catch (err: any) {
      dnsResult = {
        error: "Falha ao resolver DNS",
        detalhe: err?.message || "erro desconhecido"
      };
    }

    // ✅ Resposta final
    return res.status(200).json({
      dominio,
      status: "ok",
      origem: "vercel-serverless",
      dns: dnsResult,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    return res.status(500).json({
      error: "Erro interno no diagnóstico"
    });
  }
}
