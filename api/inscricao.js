import { db, rodadaAtual, inscricoesDe } from "../lib/db.js";
import { ESTUDANTES } from "../lib/estudantes.js";
import { COMPONENTES, ofertas, AV, EX } from "../lib/dados.js";

// POST /api/inscricao  { m, escolhas: { BASE: ["BASE 01", "BASE 04", "BASE 02"], ... } }
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido" });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const m = String(body.m || "").trim();
  const e = ESTUDANTES[m];
  if (!e) return res.status(404).json({ erro: "Matrícula não encontrada." });
  const escolhas = body.escolhas || {};

  try {
    const sql = await db();
    const [rodada, atual] = await Promise.all([rodadaAtual(sql), inscricoesDe(sql, m)]);
    const jaInscreveu = Object.keys(atual).length > 0;

    // Na primeira inscrição o estudante escolhe todas as componentes.
    // Nas rodadas seguintes, só as componentes em que ficou excedido.
    let pendentes;
    if (!jaInscreveu) pendentes = COMPONENTES.map((c) => c.k);
    else if (rodada === 1) return res.status(409).json({ erro: "Sua inscrição já foi enviada. Aguarde a validação da coordenação." });
    else pendentes = COMPONENTES.map((c) => c.k).filter((k) => !atual[k] || atual[k].st === EX);
    if (!pendentes.length) return res.status(409).json({ erro: "Não há componentes pendentes de inscrição." });

    const enviadas = Object.keys(escolhas).sort().join(",");
    if (enviadas !== [...pendentes].sort().join(",")) {
      return res.status(400).json({ erro: "Escolha as opções de todas as componentes pendentes: " + pendentes.join(", ") + "." });
    }

    const linhas = [];
    for (const k of pendentes) {
      const c = COMPONENTES.find((x) => x.k === k);
      const validas = ofertas(c, e.y).map(([x]) => x);
      const ch = Array.isArray(escolhas[k]) ? escolhas[k].map(String) : [];
      if (ch.length < 1 || ch.length > 3 || new Set(ch).size !== ch.length || !ch.every((x) => validas.includes(x))) {
        return res.status(400).json({ erro: "Opções inválidas em " + c.t + "." });
      }
      linhas.push([k, ch]);
    }

    await sql.transaction(
      linhas.map(([k, ch]) => sql`
        insert into inscricoes (matricula, componente, opcoes, status, oferta, rodada, atualizado)
        values (${m}, ${k}, ${ch}, ${AV}, null, ${rodada}, now())
        on conflict (matricula, componente) do update
        set opcoes = excluded.opcoes, status = excluded.status, oferta = null,
            rodada = excluded.rodada, atualizado = now()`)
    );
    return res.status(200).json({ ok: true, c: await inscricoesDe(sql, m), rodada });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: "Não foi possível gravar a inscrição. Tente novamente." });
  }
}
