# Inscrição em Componentes 27.1

Aplicativo web (mobile, alto contraste) para estudantes se inscreverem nas componentes ofertadas em 2027.1, com validação pela coordenação. Roda na **Vercel** com banco **Postgres (Neon)**.

## Componentes e ofertas

| Componente | Ofertas | Vagas por oferta |
|---|---|---|
| BASE — Base de Autonomia e Emancipação | 9 | 18 |
| OFLEM — Oficinas Livres | 6 | 30 |
| PI — Projeto Integrador | 8 | 22 |
| OFTEC — Oficinas Técnicas | 6 | 30 (OFTEC 01 reservada para ingressantes) |

As ofertas e vagas ficam em `lib/dados.js`. Os estudantes (matrícula, nome e ano) ficam na tabela `estudantes` do Postgres.

## Fluxo

1. O estudante entra com a matrícula e vê o próprio nome.
2. Em cada componente escolhe 1ª, 2ª e 3ª opção. Ao confirmar, as escolhas ficam com status **avaliação**.
3. A coordenação entra com a matrícula e a senha e valida. Cada escolha vira **inscrito** ou **excedido**, pela cota por ano (total de estudantes do ano ÷ número de ofertas, só na 1ª rodada), com prioridade para estudantes prioritários e de maior frequência.
4. A coordenação exibe o arquivo de inscrições (CSV) e pode iniciar uma nova rodada.
5. Na nova rodada, excedidos se inscrevem de novo só nas componentes pendentes; inscritos emitem o comprovante em PDF.

## Estrutura

```
public/index.html     interface (estudante e coordenação)
public/logo.png       logo do Instituto Federal
api/estudante.js      GET  consulta matrícula, status e vagas
api/inscricao.js      POST envia as escolhas do estudante
api/coordenacao.js    POST resumo, validar, csv, rodada (exige senha)
lib/                  ofertas e conexão com o banco
schema.sql            tabelas (criadas automaticamente na primeira chamada)
```

## Publicar na Vercel

1. Na Vercel, **Add New → Project** e importe este repositório. Framework: **Other**. Não precisa de comando de build.
2. Na aba **Storage** do projeto, crie um banco **Neon (Postgres)** e conecte ao projeto. A Vercel cria a variável `DATABASE_URL`.
3. Em **Settings → Environment Variables**, crie `COORD_SENHA` com a senha da coordenação.
4. No SQL Editor do Neon, rode `estudantes.sql` e `frequencia.sql`.
5. Faça o deploy (ou **Redeploy** se o projeto já existia antes das variáveis).

As tabelas são criadas sozinhas no primeiro acesso.

## Estudantes, prioridade e frequência

Ficam no Postgres, nas tabelas `estudantes` (matrícula, nome e ano) e `frequencia` (matrícula, prioritário e frequência). Para carregar ou atualizar, rode `estudantes.sql` e `frequencia.sql` no SQL Editor do Neon. Os dois podem ser rodados de novo sem duplicar registros. Esses arquivos têm dados pessoais dos estudantes e ficam fora do repositório.

O painel da coordenação mostra quantos estudantes há em cada tabela e só libera a validação quando as duas têm dados.
