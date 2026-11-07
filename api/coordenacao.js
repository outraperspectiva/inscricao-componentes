import crypto from "node:crypto";
import { db, rodadaAtual } from "../lib/db.js";
import { ESTUDANTES } from "../lib/estudantes.js";
import { COMPONENTES, COORDENACAO, ofertas, codigo, AV, IN, EX } from "../lib/dados.js";

const hash = (s) => crypto.createHash("sha256").update(String(s)).digest();
function senhaOk(senha) {
  const certa = process.env.COORD_SENHA;
  if (!certa) throw Object.assign(new Error("COORD_SENHA não configurada"), { config: true });
  return crypto.timingSafeEqual(hash(senha), hash(certa));
}

// POST /api/coordenacao  { m, senha, acao: "resumo" | "validar" | "csv" | "rodada" }
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido" });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const m = String(body.m || "").trim();
  try {
    if (!COORDENACAO[m] || !senhaOk(body.senha || "")) return res.status(401).json({ erro: "Matrícula ou senha da coordenação incorreta." });
  } catch (err) {
    return res.status(500).json({ erro: "A senha da coordenação não foi configurada na Vercel (COORD_SENHA)." });
  }

  try {
    const sql = await db();
    res.setHeader("Cache-Control", "no-store");
    switch (body.acao) {
      case "resumo":
        return res.status(200).json(await resumo(sql));
      case "validar": {
        const r = await validar(sql);
        if (r.erro) return res.status(409).json(r);
        return res.status(200).json({ ...(await resumo(sql)), alterados: r.alterados });
      }
      case "csv":
        return csv(sql, res);
      case "rodada": {
        const atual = await rodadaAtual(sql);
        await sql`insert into config (chave, valor) values ('rodada', ${atual + 1})
                  on conflict (chave) do update set valor = excluded.valor`;
        return res.status(200).json(await resumo(sql));
      }
      default:
        return res.status(400).json({ erro: "Ação desconhecida." });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: "Banco de dados indisponível. Tente novamente em instantes." });
  }
}

async function resumo(sql) {
  const [rodada, rows, f] = await Promise.all([
    rodadaAtual(sql),
    sql`select componente, status, oferta, count(*)::int as n from inscricoes group by componente, status, oferta`,
    sql`select count(*)::int as n from frequencia`,
  ]);
  const r = {};
  for (const c of COMPONENTES) r[c.k] = { ofertas: Object.fromEntries(c.o.map((_, i) => [codigo(c, i), 0])), av: 0, ex: 0 };
  for (const x of rows) {
    const o = r[x.componente];
    if (!o) continue;
    if (x.status === IN && x.oferta in o.ofertas) o.ofertas[x.oferta] += Number(x.n);
    else if (x.status === AV) o.av += Number(x.n);
    else if (x.status === EX) o.ex += Number(x.n);
  }
  return { rodada, resumo: r, frequencia: Number(f[0].n), componentes: COMPONENTES };
}

// Distribui as inscrições em avaliação conforme as Regras de Inscrição.
async function validar(sql) {
  const [rodada, freq, rows] = await Promise.all([
    rodadaAtual(sql),
    sql`select matricula, prioritario, frequencia from frequencia`,
    sql`select matricula, componente, opcoes, status, oferta, atualizado from inscricoes order by atualizado, matricula`,
  ]);
  if (!freq.length) return { erro: "A tabela de prioridade e frequência está vazia. Rode o frequencia.sql no SQL Editor do Neon." };
  const F = Object.fromEntries(freq.map((x) => [x.matricula, { p: !!x.prioritario, f: Number(x.frequencia) || 0 }]));

  // Total de estudantes por ano, para a cota de cada oferta.
  const T = { 1: 0, 2: 0, 3: 0 };
  for (const e of Object.values(ESTUDANTES)) T[e.y] = (T[e.y] || 0) + 1;

  const mudancas = [];
  for (const c of COMPONENTES) {
    const k = c.k, oc = {}, oy = {}, Q = {};
    [1, 2, 3].forEach((y) => (Q[y] = Math.ceil(T[y] / ofertas(c, y).length)));
    const daComp = rows.filter((x) => x.componente === k && ESTUDANTES[x.matricula]);
    for (const x of daComp) {
      if (x.status === IN && x.oferta) {
        const y = ESTUDANTES[x.matricula].y;
        oc[x.oferta] = (oc[x.oferta] || 0) + 1;
        oy[x.oferta + "|" + y] = (oy[x.oferta + "|" + y] || 0) + 1;
      }
    }
    // Prioritários primeiro; depois maior frequência; empate: quem enviou antes.
    const fila = daComp.filter((x) => x.status === AV).sort((a, b) =>
      (F[b.matricula]?.p ? 1 : 0) - (F[a.matricula]?.p ? 1 : 0) ||
      (F[b.matricula]?.f || 0) - (F[a.matricula]?.f || 0));
    for (const x of fila) {
      const y = ESTUDANTES[x.matricula].y;
      const permitidas = ofertas(c, y).map((z) => z[0]);
      let st = EX, of = null;
      for (const o of x.opcoes) {
        if (!permitidas.includes(o) || (oc[o] || 0) >= c.q) continue;
        if (rodada === 1 && (oy[o + "|" + y] || 0) >= Q[y]) continue; // cota por ano só na 1ª rodada
        st = IN; of = o;
        oc[o] = (oc[o] || 0) + 1;
        oy[o + "|" + y] = (oy[o + "|" + y] || 0) + 1;
        break;
      }
      mudancas.push([x.matricula, k, st, of]);
    }
  }

  if (mudancas.length) {
    const col = (i) => mudancas.map((z) => z[i]);
    await sql`
      update inscricoes i set status = u.s, oferta = u.o, atualizado = now()
      from unnest(${col(0)}::text[], ${col(1)}::text[], ${col(2)}::text[], ${col(3)}::text[]) as u(m, k, s, o)
      where i.matricula = u.m and i.componente = u.k and i.status = ${AV}`;
  }
  return { alterados: mudancas.length };
}

async function csv(sql, res) {
  const rows = await sql`select matricula, componente, opcoes, status, oferta, rodada from inscricoes order by matricula, componente`;
  const esc = (v) => (/[;"\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
  const L = ["matricula;nome;ano;componente;opcoes;status;oferta;rodada"];
  for (const r of rows) {
    const e = ESTUDANTES[r.matricula] || { n: "", y: "" };
    L.push([r.matricula, e.n, e.y, r.componente, r.opcoes.join(" > "), r.status, r.oferta || "", r.rodada].map(esc).join(";"));
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="inscricoes.csv"');
  return res.status(200).send("\ufeff" + L.join("\n"));
}
