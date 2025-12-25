import type { VercelRequest, VercelResponse } from "vercel";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // 🔓 CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // 🛑 Preflight (CORS)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido" });
  }

  try {
    const { dominio } = req.body;

    if (!dominio) {
      return res.status(400).json({ erro: "Domínio não informado" });
    }

    // ⏳ Simulação de processamento (opção A – aguardar medições)
    await new Promise((resolve) => setTimeout(resolve, 30000)); // 30s

    // 🔎 EXEMPLO DE RESPOSTA (substitui pela sua lógica real)
    return res.status(200).json({
      dominio,
      status_geral: "Instável",
      problema_rota_internacional: false,
      continentes: {},
      texto_noc: "Medição Globalping ainda em processamento. Reexecute o teste.",
      globalping: {
        measurement_id: "exemplo_measurement_id",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Erro no diagnóstico:", error);
    return res
      .status(500)
      .json({ erro: "Erro interno ao executar diagnóstico" });
  }
}
