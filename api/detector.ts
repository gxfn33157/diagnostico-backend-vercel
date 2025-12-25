import type { VercelRequest, VercelResponse } from "@vercel/node";

const GLOBALPING_API = "https://api.globalping.io/v1/measurements";

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // =========================
  // CORS (OBRIGATÓRIO)
  // =========================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { dominio, measurement_id } = req.body;

  if (!dominio) {
    return res.status(200).json({
      dominio: null,
      status: "error",
      status_geral: "Indisponível",
      texto_noc: "Domínio não informado",
      continentes: {},
      globalping: {},
      timestamp: new Date().toISOString()
    });
  }

  try {
    // =========================
    // CASO 1: Criar medição
    // =========================
    if (!measurement_id) {
      const createResponse = await fetch(GLOBALPING_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.GLOBALPING_TOKEN && {
            Authorization: `Bearer ${process.env.GLOBALPING_TOKEN}`
          })
        },
        body: JSON.stringify({
          type: "ping",
          target: dominio,
          limit: 50
        })
      });

      const created = await createResponse.json();

      return res.status(200).json({
        dominio,
        status: "processing",
        status_geral: "Instável",
        texto_noc: "Medição Globalping em processamento. Aguarde.",
        continentes: {},
        globalping: {
          measurement_id: created.id
        },
        timestamp: new Date().toISOString()
      });
    }

    // =========================
    // CASO 2: Consultar medição
    // =========================
    const maxTentativas = 6; // ~30s
    let resultado: any = null;

    for (let i = 0; i < maxTentativas; i++) {
      const checkResponse = await fetch(`${GLOBALPING_API}/${measurement_id}`, {
        headers: {
          ...(process.env.GLOBALPING_TOKEN && {
            Authorization: `Bearer ${process.env.GLOBALPING_TOKEN}`
          })
        }
      });

      resultado = await checkResponse.json();

      if (resultado.status === "finished") break;

      await sleep(5000);
    }

    if (!resultado || resultado.status !== "finished") {
      return res.status(200).json({
        dominio,
        status: "processing",
        status_geral: "Instável",
        texto_noc: "Medição Globalping ainda em processamento. Reexecute o teste.",
        continentes: {},
        globalping: {
          measurement_id
        },
        timestamp: new Date().toISOString()
      });
    }

    // =========================
    // PROCESSAR RESULTADOS
    // =========================
    const continentes: Record<string, { ok: number; falha: number }> = {};

    for (const probe of resultado.results || []) {
      const cont = probe.probe?.continent || "UNK";
      if (!continentes[cont]) {
        continentes[cont] = { ok: 0, falha: 0 };
      }

      if (probe.result?.status === "finished") {
        continentes[cont].ok++;
      } else {
        continentes[cont].falha++;
      }
    }

    const continentesComFalha = Object.values(continentes).filter(
      c => c.falha > 0
    ).length;

    let status_geral = "OK";
    if (continentesComFalha === 1) status_geral = "Instável";
    if (continentesComFalha >= 2) status_geral = "Indisponível";

    return res.status(200).json({
      dominio,
      status: "finished",
      status_geral,
      problema_rota_internacional: continentesComFalha > 0,
      continentes,
      texto_noc: "",
      globalping: {
        target: dominio,
        status: resultado.status
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    return res.status(200).json({
      dominio,
      status: "error",
      status_geral: "Instável",
      texto_noc: "Erro interno ao executar diagnóstico.",
      continentes: {},
      globalping: {},
      timestamp: new Date().toISOString()
    });
  }
}
