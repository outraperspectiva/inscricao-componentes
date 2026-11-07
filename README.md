# Inscrição em Componentes

Aplicativo web (mobile, alto contraste) para estudantes se inscreverem nas componentes ofertadas a cada semestre (ciclo), com validação pela coordenação. Roda na **Vercel** com banco **Postgres (Neon)**.

## Fluxo

1. O estudante entra com a matrícula e vê o próprio nome.
2. Em cada componente escolhe 1ª, 2ª e 3ª opção. Ao confirmar, as escolhas ficam com status **avaliação**.
3. A coordenação entra com a matrícula e a senha e valida. Cada escolha vira **inscrito** ou **excedido**, respeitando as vagas de cada oferta e a cota por ano (total de estudantes do ano ÷ número de ofertas, só na 1ª rodada), com prioridade para estudantes prioritários e de maior frequência.
4. A coordenação baixa o arquivo de inscrições (Excel) e pode iniciar uma nova rodada. O arquivo tem três abas: **Resultado** (uma linha por estudante, com matrícula, nome, ano, prioridade, frequência, a oferta em que ficou inscrito em cada componente e a situação geral), **Escolhas** (as opções de cada estudante em cada componente) e **Ofertas** (vagas, inscritos e vagas livres).
5. Na nova rodada, excedidos se inscrevem de novo só nas componentes pendentes; inscritos emitem o comprovante em PDF.

## Dados no banco

Tudo fica no Postgres e é mantido pelo painel da coordenação, sem mexer no código:

| Tabela | Conteúdo | Colunas da planilha |
|---|---|---|
| `estudantes` | quem pode se inscrever | Matrícula, Nome, Ano (1, 2 ou 3) |
| `frequencia` | ordem de prioridade na validação | Matrícula, Prioridade (SIM/NÃO), Frequência (%) |
| `ofertas` | componentes, ofertas e vagas | Componente, Nome da componente, Oferta, Descrição, Vagas, Anos (vazio = todos) |
| `inscricoes` | escolhas e resultado de cada estudante | (preenchida pelo app) |

No painel:

- **Atualizar dados**: envie uma planilha (.xlsx, .xls ou .csv) para cada tabela. O app lê a primeira aba, acha as colunas pelos títulos e confere tudo antes de gravar. Se houver erro, nada é gravado e o painel mostra as linhas com problema. Cada envio substitui os dados daquela tabela. **Baixar atual** gera a planilha com os dados atuais, no formato certo para editar e enviar de novo.
- **Novo ciclo**: usado no começo de cada semestre. Zera o banco (estudantes, prioridade e frequência, ofertas e todas as inscrições), volta para a rodada 1 e grava o nome do novo ciclo (ex.: 27.2), que aparece no título do app e no comprovante. Pede o nome do ciclo, a confirmação NOVO CICLO e oferece baixar uma cópia do ciclo atual antes. Depois, envie as planilhas do novo semestre em **Atualizar dados**.

## Estrutura

```
public/index.html     interface (estudante e coordenação)
public/logo.png       logo do Instituto Federal
api/ciclo.js          GET  nome do ciclo atual
api/estudante.js      GET  consulta matrícula, status e vagas
api/inscricao.js      POST envia as escolhas do estudante
api/coordenacao.js    POST resumo, validar, relatorio, rodada, exportar, importar, novo_ciclo (exige senha)
lib/                  regras, coordenação e conexão com o banco
schema.sql            tabelas (criadas automaticamente na primeira chamada)
```

A matrícula da coordenação fica em `lib/dados.js`.

## Publicar na Vercel

1. Na Vercel, **Add New → Project** e importe este repositório. Framework: **Other**. Não precisa de comando de build.
2. Na aba **Storage** do projeto, crie um banco **Neon (Postgres)** e conecte ao projeto. A Vercel cria a variável `DATABASE_URL`.
3. Em **Settings → Environment Variables**, crie `COORD_SENHA` com a senha da coordenação.
4. Faça o deploy (ou **Redeploy** se o projeto já existia antes das variáveis).
5. Entre como coordenação e envie as três planilhas em **Atualizar dados**.
