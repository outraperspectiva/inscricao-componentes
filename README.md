# Inscrição em Componentes 27.1

Aplicativo web (PWA, mobile, alto contraste) para estudantes se inscreverem nas componentes ofertadas em 2027.1, com validação pela coordenação.

## Componentes e ofertas

| Componente | Ofertas | Vagas por oferta |
|---|---|---|
| BASE — Base de Autonomia e Emancipação | 9 | 18 |
| OFLEM — Oficinas Livres | 6 | 20 |
| PI — Projeto Integrador | 8 | 22 |
| OFTEC — Oficinas Técnicas | 6 | 30 (OFTEC 01 reservada para ingressantes) |

## Fluxo

1. O estudante entra com a matrícula e vê o próprio nome.
2. Em cada componente escolhe 1ª, 2ª e 3ª opção.
3. Ao confirmar, as escolhas ficam com status **avaliação**.
4. A coordenação valida: o sistema distribui as vagas pela cota por ano (total de estudantes do ano ÷ número de ofertas), com prioridade para estudantes prioritários e de maior frequência. Cada escolha vira **inscrito** ou **excedido**.
5. A coordenação exibe o arquivo de inscrições (CSV) e pode iniciar uma nova rodada.
6. Na nova rodada, excedidos se inscrevem de novo; inscritos emitem o comprovante em PDF.

## Estado atual

O arquivo `index.html` é a versão publicada como artefato no Claude. Ele usa o runtime de artefatos (`claude.use("db")` e `claude.use("downloads")`) para gravar inscrições e baixar arquivos. Para rodar na Vercel, essas chamadas precisam ser trocadas por uma API própria com banco Postgres (Neon).
