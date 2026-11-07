import crypto from "node:crypto";
import { db, rodadaAtual, cicloAtual, carregarComponentes } from "../lib/db.js";
import { COORDENACAO, ofertas, AV, IN, EX } from "../lib/dados.js";

const hash = (s) => crypto.createHash("sha256").update(String(s)).digest();
function senhaOk(senha) {
  const certa = process.env.COORD_SENHA;
  if (!certa) throw Object.assign(new Error("COORD_SENHA não configurada"), { config: true });
  return crypto.timingSafeEqual(hash(senha), hash(certa));
}

// POST /api/coordenacao  { m, senha, acao, ... }
// acao: "resumo" | "validar" | "relatorio" | "rodada" | "exportar" | "importar" (tabela, linhas) | "novo_ciclo" (ciclo, confirmacao: "NOVO CICLO")
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
      case "relatorio":
        return res.status(200).json(await relatorio(sql));
      case "rodada": {
        const atual = await rodadaAtual(sql);
        await sql`insert into config (chave, valor) values ('rodada', ${atual + 1})
                  on conflict (chave) do update set valor = excluded.valor`;
        return res.status(200).json(await resumo(sql));
      }
      case "exportar":
        return res.status(200).json(await exportar(sql));
      case "importar": {
        const r = await importar(sql, String(body.tabela || ""), Array.isArray(body.linhas) ? body.linhas : []);
        if (r.erros) return res.status(400).json(r);
        return res.status(200).json({ ...(await resumo(sql)), importado: r });
      }
      case "novo_ciclo": {
        // Começa um novo semestre: zera todos os dados e grava o nome do novo ciclo.
        const ciclo = String(body.ciclo || "").trim();
        if (!ciclo || ciclo.length > 20) return res.status(400).json({ erro: "Informe o nome do novo ciclo (até 20 caracteres), por exemplo 27.2." });
        if (body.confirmacao !== "NOVO CICLO") return res.status(400).json({ erro: "Digite NOVO CICLO para confirmar." });
        await sql.transaction([
          sql`delete from inscricoes`,
          sql`delete from frequencia`,
          sql`delete from estudantes`,
          sql`delete from ofertas`,
          sql`delete from config where chave = 'rodada'`,
          sql`insert into textos (chave, valor) values ('ciclo', ${ciclo})
              on conflict (chave) do update set valor = excluded.valor`,
        ]);
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
  const [rodada, rows, f, ne, componentes, ni, ciclo] = await Promise.all([
    rodadaAtual(sql),
    sql`select componente, status, oferta, count(*)::int as n from inscricoes group by componente, status, oferta`,
    sql`select count(*)::int as n from frequencia`,
    sql`select count(*)::int as n from estudantes`,
    carregarComponentes(sql),
    sql`select count(distinct matricula)::int as n from inscricoes`,
    cicloAtual(sql),
  ]);
  const r = {};
  for (const c of componentes) r[c.k] = { ofertas: Object.fromEntries(c.o.map((o) => [o.x, 0])), av: 0, ex: 0 };
  for (const x of rows) {
    const o = r[x.componente];
    if (!o) continue;
    if (x.status === IN && x.oferta in o.ofertas) o.ofertas[x.oferta] += Number(x.n);
    else if (x.status === AV) o.av += Number(x.n);
    else if (x.status === EX) o.ex += Number(x.n);
  }
  const nOfertas = componentes.reduce((s, c) => s + c.o.length, 0);
  return { ciclo, rodada, resumo: r, componentes, frequencia: Number(f[0].n), estudantes: Number(ne[0].n), ofertas: nOfertas, inscritos: Number(ni[0].n) };
}

// Distribui as inscrições em avaliação conforme as Regras de Inscrição.
async function validar(sql) {
  const [rodada, freq, rows, est, COMPONENTES] = await Promise.all([
    rodadaAtual(sql),
    sql`select matricula, prioritario, frequencia from frequencia`,
    sql`select matricula, componente, opcoes, status, oferta, atualizado from inscricoes order by atualizado, matricula`,
    sql`select matricula, ano from estudantes`,
    carregarComponentes(sql),
  ]);
  if (!est.length) return { erro: "A tabela de estudantes está vazia. Atualize os dados no painel." };
  if (!freq.length) return { erro: "A tabela de prioridade e frequência está vazia. Atualize os dados no painel." };
  if (!COMPONENTES.length) return { erro: "Nenhuma componente cadastrada. Atualize os dados no painel." };
  const ESTUDANTES = Object.fromEntries(est.map((x) => [x.matricula, { y: Number(x.ano) }]));
  const F = Object.fromEntries(freq.map((x) => [x.matricula, { p: !!x.prioritario, f: Number(x.frequencia) || 0 }]));

  // Total de estudantes por ano, para a cota de cada oferta.
  const T = { 1: 0, 2: 0, 3: 0 };
  for (const e of Object.values(ESTUDANTES)) T[e.y] = (T[e.y] || 0) + 1;

  const mudancas = [];
  for (const c of COMPONENTES) {
    const k = c.k, oc = {}, oy = {}, Q = {};
    [1, 2, 3].forEach((y) => { const n = ofertas(c, y).length; Q[y] = n ? Math.ceil(T[y] / n) : 0; });
    const vagas = Object.fromEntries(c.o.map((o) => [o.x, o.q]));
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
      const permitidas = ofertas(c, y).map((o) => o.x);
      let st = EX, of = null;
      for (const o of x.opcoes) {
        if (!permitidas.includes(o) || (oc[o] || 0) >= vagas[o]) continue;
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

// Resultado das inscrições: um registro por estudante, com a situação em cada componente.
async function relatorio(sql) {
  const [est, freq, ins, componentes, ciclo, rodada] = await Promise.all([
    sql`select matricula, nome, ano from estudantes order by nome`,
    sql`select matricula, prioritario, frequencia from frequencia`,
    sql`select matricula, componente, opcoes, status, oferta, rodada from inscricoes`,
    carregarComponentes(sql),
    cicloAtual(sql),
    rodadaAtual(sql),
  ]);
  const F = Object.fromEntries(freq.map((x) => [x.matricula, x]));
  const I = {};
  for (const x of ins) (I[x.matricula] = I[x.matricula] || {})[x.componente] = { st: x.status, of: x.oferta, ch: x.opcoes, r: Number(x.rodada) };
  return {
    ciclo, rodada,
    componentes: componentes.map((c) => ({ k: c.k, t: c.t, o: c.o.map((o) => ({ x: o.x, d: o.d, q: o.q })) })),
    estudantes: est.map((e) => ({
      matricula: e.matricula, nome: e.nome, ano: Number(e.ano),
      prioridade: F[e.matricula] ? (F[e.matricula].prioritario ? "SIM" : "NÃO") : "",
      frequencia: F[e.matricula] ? Number(F[e.matricula].frequencia) : null,
      c: I[e.matricula] || {},
    })),
  };
}

// Dados atuais, para baixar como planilha (serve de modelo para atualizar).
async function exportar(sql) {
  const [est, freq, ofs] = await Promise.all([
    sql`select matricula, nome, ano from estudantes order by nome`,
    sql`select f.matricula, e.nome, f.prioritario, f.frequencia from frequencia f left join estudantes e on e.matricula = f.matricula order by e.nome nulls last, f.matricula`,
    sql`select componente, titulo, codigo, descricao, vagas, anos from ofertas order by ordem, codigo`,
  ]);
  return {
    estudantes: est.map((r) => ({ matricula: r.matricula, nome: r.nome, ano: Number(r.ano) })),
    frequencia: freq.map((r) => ({ matricula: r.matricula, nome: r.nome || "", prioridade: r.prioritario ? "SIM" : "NÃO", frequencia: Number(r.frequencia) })),
    ofertas: ofs.map((r) => ({ componente: r.componente, titulo: r.titulo, oferta: r.codigo, descricao: r.descricao, vagas: Number(r.vagas), anos: (r.anos || []).join(", ") })),
  };
}

// ---------- Importação das planilhas ----------
const txt = (v) => (v === null || v === undefined ? "" : String(v).trim());
const matricula = (v) => (typeof v === "number" ? String(Math.round(v)) : txt(v).replace(/\D/g, ""));
const numero = (v) => (typeof v === "number" ? v : parseFloat(txt(v).replace("%", "").replace(/\s/g, "").replace(",", ".")));
const MAX_LINHAS = 5000;

async function importar(sql, tabela, linhas) {
  if (!linhas.length) return { erros: ["A planilha não tem linhas de dados."] };
  if (linhas.length > MAX_LINHAS) return { erros: ["A planilha tem linhas demais (máximo " + MAX_LINHAS + ")."] };
  const erros = [];
  const erro = (l, msg) => erros.push("Linha " + (l.linha || "?") + ": " + msg);

  if (tabela === "estudantes") {
    const vistos = new Set(), dados = [];
    for (const l of linhas) {
      const m = matricula(l.matricula), n = txt(l.nome), y = Math.round(numero(l.ano));
      if (!m && !n) continue;
      if (m.length < 5) { erro(l, "matrícula inválida."); continue; }
      if (vistos.has(m)) { erro(l, "matrícula " + m + " repetida."); continue; }
      if (!n) { erro(l, "nome vazio."); continue; }
      if (![1, 2, 3].includes(y)) { erro(l, "ano \"" + txt(l.ano) + "\" inválido (use 1, 2 ou 3)."); continue; }
      vistos.add(m); dados.push([m, n, y]);
    }
    if (erros.length) return { erros };
    if (!dados.length) return { erros: ["Nenhum estudante encontrado. Confira as colunas Matrícula, Nome e Ano."] };
    const col = (i) => dados.map((z) => z[i]);
    await sql.transaction([
      sql`delete from estudantes`,
      sql`insert into estudantes (matricula, nome, ano) select * from unnest(${col(0)}::text[], ${col(1)}::text[], ${col(2)}::int[])`,
    ]);
    const porAno = [1, 2, 3].map((a) => dados.filter((z) => z[2] === a).length);
    return { tabela, linhas: dados.length, detalhe: `${porAno[0]} no 1º ano, ${porAno[1]} no 2º e ${porAno[2]} no 3º` };
  }

  if (tabela === "frequencia") {
    const vistos = new Set(), dados = [];
    const freqs = linhas.map((l) => numero(l.frequencia)).filter((x) => !isNaN(x));
    const fracao = freqs.length > 0 && freqs.every((x) => x <= 1); // planilha com frequência em % formatada (0,925)
    for (const l of linhas) {
      const m = matricula(l.matricula);
      if (!m && !txt(l.frequencia)) continue;
      if (m.length < 5) { erro(l, "matrícula inválida."); continue; }
      if (vistos.has(m)) { erro(l, "matrícula " + m + " repetida."); continue; }
      const pr = txt(l.prioridade).toUpperCase();
      if (pr && !/^(SIM|S|X|1|VERDADEIRO|TRUE|NÃO|NAO|N|0|FALSO|FALSE)$/.test(pr)) { erro(l, "prioridade \"" + txt(l.prioridade) + "\" inválida (use SIM ou NÃO)."); continue; }
      let f = numero(l.frequencia);
      if (isNaN(f)) { erro(l, "frequência vazia ou inválida."); continue; }
      if (fracao) f = f * 100;
      if (f < 0 || f > 100) { erro(l, "frequência " + txt(l.frequencia) + " fora de 0 a 100."); continue; }
      vistos.add(m); dados.push([m, /^(SIM|S|X|1|VERDADEIRO|TRUE)$/.test(pr), Math.round(f * 100) / 100]);
    }
    if (erros.length) return { erros };
    if (!dados.length) return { erros: ["Nenhum dado encontrado. Confira as colunas Matrícula, Prioridade e Frequência."] };
    const col = (i) => dados.map((z) => z[i]);
    await sql.transaction([
      sql`delete from frequencia`,
      sql`insert into frequencia (matricula, prioritario, frequencia) select * from unnest(${col(0)}::text[], ${col(1)}::boolean[], ${col(2)}::numeric[])`,
    ]);
    const est = new Set((await sql`select matricula from estudantes`).map((r) => r.matricula));
    const fora = dados.filter((z) => !est.has(z[0])).length;
    const pri = dados.filter((z) => z[1]).length;
    return { tabela, linhas: dados.length, detalhe: `${pri} prioritários` + (fora ? `; ${fora} matrículas não estão na tabela de estudantes` : "") };
  }

  if (tabela === "ofertas") {
    const vistos = new Set(), dados = [], titulos = {};
    linhas.forEach((l, i) => {
      const k = txt(l.componente).toUpperCase(), x = txt(l.oferta).toUpperCase().replace(/\s+/g, " ");
      if (!k && !x) return;
      if (!k) return erro(l, "componente vazia.");
      if (!x) return erro(l, "código da oferta vazio.");
      if (vistos.has(x)) return erro(l, "oferta " + x + " repetida.");
      const t = txt(l.titulo) || titulos[k];
      if (!t) return erro(l, "nome da componente vazio.");
      titulos[k] = titulos[k] || t;
      const q = numero(l.vagas);
      if (!Number.isInteger(q) || q < 1) return erro(l, "vagas \"" + txt(l.vagas) + "\" inválidas.");
      const a = txt(l.anos);
      const anos = a && !/todos/i.test(a) ? [...new Set((a.match(/[123]/g) || []).map(Number))].sort() : [1, 2, 3];
      if (!anos.length || (!/todos/i.test(a) && /[04-9]/.test(a.replace(/[ºª°]/g, "")))) return erro(l, "anos \"" + a + "\" inválidos (use 1, 2, 3 ou deixe vazio para todos).");
      vistos.add(x); dados.push([x, k, titulos[k], txt(l.descricao), q, "{" + anos.join(",") + "}", i]);
    });
    if (erros.length) return { erros };
    if (!dados.length) return { erros: ["Nenhuma oferta encontrada. Confira as colunas Componente, Nome da componente, Oferta e Vagas."] };
    const col = (i) => dados.map((z) => z[i]);
    await sql.transaction([
      sql`delete from ofertas`,
      sql`insert into ofertas (codigo, componente, titulo, descricao, vagas, anos, ordem)
          select u.x, u.k, u.t, u.d, u.q, u.a::int[], u.o
          from unnest(${col(0)}::text[], ${col(1)}::text[], ${col(2)}::text[], ${col(3)}::text[], ${col(4)}::int[], ${col(5)}::text[], ${col(6)}::int[]) as u(x, k, t, d, q, a, o)`,
    ]);
    const comps = [...new Set(dados.map((z) => z[1]))];
    return { tabela, linhas: dados.length, detalhe: comps.length + " componentes: " + comps.join(", ") };
  }

  return { erros: ["Tabela desconhecida."] };
}
