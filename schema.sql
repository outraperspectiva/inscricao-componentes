-- As tabelas são criadas automaticamente na primeira chamada à API.
-- Este arquivo serve de referência ou para criar tudo manualmente no painel do Neon.
create table if not exists inscricoes (
  matricula text not null,
  componente text not null,
  opcoes text[] not null,
  status text not null,          -- avaliação | inscrito | excedido
  oferta text,                   -- oferta em que o estudante ficou inscrito
  rodada int not null,
  atualizado timestamptz not null default now(),
  primary key (matricula, componente)
);
create table if not exists frequencia (
  matricula text primary key,
  prioritario boolean not null default false,
  frequencia numeric not null default 0
);
create table if not exists config (chave text primary key, valor int not null);
