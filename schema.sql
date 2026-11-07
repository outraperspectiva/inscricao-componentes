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
create table if not exists estudantes (
  matricula text primary key,
  nome      text not null,
  ano       int  not null check (ano between 1 and 3)
);
create table if not exists ofertas (
  codigo     text primary key,   -- ex.: BASE 01
  componente text not null,      -- ex.: BASE
  titulo     text not null,      -- nome da componente
  descricao  text not null default '',
  vagas      int  not null check (vagas > 0),
  anos       int[] not null default '{1,2,3}',  -- anos que podem escolher a oferta
  ordem      int  not null default 0
);
create table if not exists textos (chave text primary key, valor text not null);  -- 'ciclo' = nome do semestre
