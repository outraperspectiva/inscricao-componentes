// Matrículas da coordenação (o acesso também exige a senha COORD_SENHA).
export const COORDENACAO = { "1651799": "Glauco Vaz Feijo" };

export const AV = "avaliação", IN = "inscrito", EX = "excedido";

// Ofertas de uma componente que um estudante do ano "y" pode escolher.
// Cada oferta: { x: código, d: descrição, q: vagas, anos: [1, 2, 3] }
export const ofertas = (c, y) => c.o.filter((o) => o.anos.includes(y));
