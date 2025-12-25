import type { VercelRequest, VercelResponse } from "@vercel/node";

const GLOBALPING_API = "https://api.globalping.io/v1";

/* ===============================
   Função para aguardar Globalping
================================ */
async function aguardarResultado(
  measurement_id: string,
  tentativas = 6
) {
  for (let i = 0; i < tentativas; i++) {
    await new Promise((r) => setTimeout(r, 3000));

    const res = await fetch(
      `${GLOBALPING_API}/measurements/${measurement_id}`
    );
    const data = await res.json();

    if (data.status === "finished" && data.probes?.length > 0) {
      return data;
    }
  }

  return null;
}

/* ===============================
   API Principal
================================ */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { dominio } = req.body;

    if (!dominio) {
      return res.status(400).json({ erro: "Domínio não informado" });
    }

    /* ===============================
       Cria medição Globalping
    ================================ */
    const create = await fetch(`${GLOBALPING_API}/measurements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "ping",
        target: dominio,
        locations: [
          { continent: "South America", limit: 4 },
          { continent: "North America", limit: 4 },
          { continent: "Europe", limit: 4 },
          { continent: "Asia", limit: 4 }
        ]
      })
    });

    const created = await create.json();
    const measurement_id = created.id;

    /* ===============================
       Aguarda resultado real
    ================================ */
    const resultado = await aguardarResultado(measurement_id);

    if (!resultado) {
      return res.status(200).json({
        dominio,
        status_geral: "Instável",
        problema_rota_internacional: false,
        continentes: {},
        texto_noc:
          "Medição Globalping ainda em processamento. Reexecute o teste.",
        globalping: { measurement_id },
        timestamp: new Date().toISOString()
      });
    }

    /* ===============================
       Processamento por continente
    ================================ */
    const continentes: Record<
      string,
      { ok: number; fail: number }
    > = {};

    for (const probe of resultado.probes) {
      const continente = probe.location?.continent || "Desconhecido";

      if (!continentes[continente]) {
        continentes[continente] = { ok: 0, fail: 0 };
      }

      if (probe.result?.status === "finished") {
        continentes[continente].ok++;
      } else {
        continentes[continente].fail++;
      }
    }

    /* ===============================
       Análise de rota internacional
    ================================ */
    let problema_rota_internacional = false;
    let continentes_com_falha = 0;

    for (const c of Object.values(continentes)) {
      if (c.fail > 0) continentes_com_falha++;
    }

    if (
      continentes_com_falha > 0 &&
      continentes_com_falha < Object.keys(continentes).length
    ) {
      problema_rota_internacional = true;
    }

    /* ===============================
       Status geral
    ================================ */
    let status_geral = "OK";

    if (Object.keys(continentes).length === 0) {
      status_geral = "Instável";
    } else if (continentes_com_falha > 0) {
      status_geral = "Instável";
    }

    /* ===============================
       Texto técnico NOC
    ================================ */
    let texto_noc = `Diagnóstico de conectividade para ${dominio}\n\n`;
    texto_noc += `Status geral: ${status_geral}\n\n`;
    texto_noc += `Resumo por continente:\n`;

    for (const [cont, dados] of Object.entries(continentes)) {
      texto_noc += `- ${cont}: ${dados.ok} OK / ${dados.fail} Falha\n`;
    }

    texto_noc += `\n`;

    if (problema_rota_internacional) {
      texto_noc +=
        "Possível problema de rota internacional detectado (falhas parciais entre continentes).";
    } else {
      texto_noc += "Não foram detectados problemas de rota internacional.";
    }

    /* ===============================
       Resposta final
    ================================ */
    return res.status(200).json({
      dominio,
      status_geral,
      problema_rota_internacional,
      continentes,
      texto_noc,
      globalping: { measurement_id },
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      erro: "Erro interno ao executar diagnóstico"
    });
  }
}
