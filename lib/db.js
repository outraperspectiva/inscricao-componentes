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
    ]).catch((e) => { pronto = null; throw e; });
  }
  await pronto;
  return sql;
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
