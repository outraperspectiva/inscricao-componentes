import { neon } from "@neondatabase/serverless";

let sql, pronto;

// Retorna o cliente SQL e garante que as tabelas existam (uma vez por instância).
export async function db() {
  if (!sql) {
    if (globalThis.__SQL_TESTE__) sql = globalThis.__SQL_TESTE__;
    else {
      const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
      if (!url) throw new Error("DATABASE_URL não configurada");
      sql = neon(url);
    }
  }
  if (!pronto) {
    pronto = sql.transaction([
      sql`create table if not exists inscricoes (
        matricula text not null,
        componente text not null,
        opcoes text[] not null,
        status text not null,
        oferta text,
        rodada int not null,
        atualizado timestamptz not null default now(),
        primary key (matricula, componente))`,
      sql`create table if not exists frequencia (
        matricula text primary key,
        prioritario boolean not null default false,
        frequencia numeric not null default 0)`,
      sql`create table if not exists config (chave text primary key, valor int not null)`,
      sql`create table if not exists textos (chave text primary key, valor text not null)`,
      sql`create table if not exists ofertas (
        codigo text primary key,
        componente text not null,
        titulo text not null,
        descricao text not null default '',
        vagas int not null check (vagas > 0),
        anos int[] not null default '{1,2,3}',
        ordem int not null default 0)`,
      sql`create table if not exists estudantes (
        matricula text primary key,
        nome text not null,
        ano int not null check (ano between 1 and 3))`,
    ]).catch((e) => { pronto = null; throw e; });
  }
  await pronto;
  return sql;
}

// Nome do ciclo de distribuição (semestre), ex.: "27.1".
export const CICLO_PADRAO = "27.1";
export async function cicloAtual(sql) {
  const r = await sql`select valor from textos where chave = 'ciclo'`;
  return r.length ? r[0].valor : CICLO_PADRAO;
}

export async function rodadaAtual(sql) {
  const r = await sql`select valor from config where chave = 'rodada'`;
  return r.length ? Number(r[0].valor) : 1;
}

// Inscrições de um estudante no formato { BASE: { ch, st, of }, ... }
export async function inscricoesDe(sql, m) {
  const rows = await sql`select componente, opcoes, status, oferta from inscricoes where matricula = ${m}`;
  return Object.fromEntries(rows.map((r) => [r.componente, { ch: r.opcoes, st: r.status, of: r.oferta }]));
}

// Quantidade de inscritos por oferta, ex.: { "BASE 01": 12 }
export async function ocupacao(sql) {
  const rows = await sql`select oferta, count(*)::int as n from inscricoes where status = 'inscrito' and oferta is not null group by oferta`;
  return Object.fromEntries(rows.map((r) => [r.oferta, Number(r.n)]));
}

// Estudante pela matrícula: { m, n, y } ou null.
export async function buscarEstudante(sql, m) {
  const r = await sql`select matricula, nome, ano from estudantes where matricula = ${m}`;
  return r.length ? { m: r[0].matricula, n: r[0].nome, y: Number(r[0].ano) } : null;
}

// Componentes e ofertas cadastradas, na ordem da planilha:
// [{ k: "BASE", t: "Base de ...", o: [{ x: "BASE 01", d: "...", q: 18, anos: [1, 2, 3] }] }]
export async function carregarComponentes(sql) {
  const rows = await sql`select codigo, componente, titulo, descricao, vagas, anos from ofertas order by ordem, codigo`;
  const C = [];
  for (const r of rows) {
    let c = C.find((x) => x.k === r.componente);
    if (!c) C.push((c = { k: r.componente, t: r.titulo, o: [] }));
    c.o.push({ x: r.codigo, d: r.descricao, q: Number(r.vagas), anos: (r.anos || []).map(Number) });
  }
  return C;
}
