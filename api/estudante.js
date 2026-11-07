import { db, rodadaAtual, inscricoesDe, ocupacao, buscarEstudante } from "../lib/db.js";
import { COORDENACAO, COMPONENTES } from "../lib/dados.js";

// GET /api/estudante?m=MATRICULA
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ erro: "Método não permitido" });
  const m = String(req.query.m || "").trim();
  if (COORDENACAO[m]) return res.status(200).json({ coordenacao: true, n: COORDENACAO[m] });
  if (!/^\d{7,15}$/.test(m)) return res.status(404).json({ erro: "Matrícula não encontrada." });
  try {
    const sql = await db();
    const e = await buscarEstudante(sql, m);
    if (!e) return res.status(404).json({ erro: "Matrícula não encontrada." });
    const [rodada, c, usados] = await Promise.all([rodadaAtual(sql), inscricoesDe(sql, m), ocupacao(sql)]);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ m, n: e.n, y: e.y, rodada, c, usados, componentes: COMPONENTES });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: "Banco de dados indisponível. Tente novamente em instantes." });
  }
}
