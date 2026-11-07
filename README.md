# Inscrição em Componentes 27.1

Aplicativo web (mobile, alto contraste) para estudantes se inscreverem nas componentes ofertadas em 2027.1, com validação pela coordenação. Roda na **Vercel** com banco **Postgres (Neon)**.

## Componentes e ofertas

| Componente | Ofertas | Vagas por oferta |
|---|---|---|
| BASE — Base de Autonomia e Emancipação | 9 | 18 |
| OFLEM — Oficinas Livres | 6 | 30 |
| PI — Projeto Integrador | 8 | 22 |
| OFTEC — Oficinas Técnicas | 6 | 30 (OFTEC 01 reservada para ingressantes) |

As ofertas e vagas ficam em `lib/dados.js`. A lista de estudantes fica em `lib/estudantes.js`.

## Fluxo

1. O estudante entra com a matrícula e vê o próprio nome.
2. Em cada componente escolhe 1ª, 2ª e 3ª opção. Ao confirmar, as escolhas ficam com status **avaliação**.
3. A coordenação entra com a matrícula e a senha, carrega os dados de prioridade e frequência e valida. Cada escolha vira **inscrito** ou **excedido**, pela cota por ano (total de estudantes do ano ÷ número de ofertas, só na 1ª rodada), com prioridade para estudantes prioritários e de maior frequência.
4. A coordenação exibe o arquivo de inscrições (CSV) e pode iniciar uma nova rodada.
5. Na nova rodada, excedidos se inscrevem de novo só nas componentes pendentes; inscritos emitem o comprovante em PDF.

## Estrutura

```
public/index.html     interface (estudante e coordenação)
public/logo.png       logo do Instituto Federal
api/estudante.js      GET  consulta matrícula, status e vagas
api/inscricao.js      POST envia as escolhas do estudante
api/coordenacao.js    POST resumo, validar, csv, frequencia, rodada (exige senha)
lib/                  dados, estudantes e conexão com o banco
schema.sql            tabelas (criadas automaticamente na primeira chamada)
```

## Publicar na Vercel

1. Na Vercel, **Add New → Project** e importe este repositório. Framework: **Other**. Não precisa de comando de build.
2. Na aba **Storage** do projeto, crie um banco **Neon (Postgres)** e conecte ao projeto. A Vercel cria a variável `DATABASE_URL`.
3. Em **Settings → Environment Variables**, crie `COORD_SENHA` com a senha da coordenação.
4. Faça o deploy (ou **Redeploy** se o projeto já existia antes das variáveis).

As tabelas são criadas sozinhas no primeiro acesso.

## Dados de prioridade e frequência

No painel da coordenação, em **Carregar frequência**, cole as colunas da planilha: matrícula, prioritário (SIM ou NÃO) e frequência. Exemplo:

```
2026101610045;SIM;92,5
```

Cada novo envio substitui os dados anteriores.
