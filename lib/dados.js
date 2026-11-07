// Componentes e ofertas de 2027.1. "q" é o limite de vagas por oferta.
export const COMPONENTES = [
  { k: "BASE", t: "Base de Autonomia e Emancipação", q: 18, o: ["Prof. Adeilton", "Profas. Izabel e Vanessa", "Profa. Jordana", "Profas. Alice e Juliana", "Profa. Juliana Fernandes", "Profs. Marcos Ramon e Guilherme", "Profa. Cristiane", "Prof. Lasneaux", "Profa. Luiza"] },
  { k: "OFLEM", t: "Oficinas Livres", q: 30, o: ["Profs. Marcos, Glauco e Guilherme", "Profas. Samantha e Washington", "Profas. Sharon e Luiza", "Profas. Waleska e Bárbara", "Profs. Cristiane e Bernardo", "Profas. Fernanda e Luciana"] },
  { k: "PI", t: "Projeto Integrador", q: 22, o: ["Compostagem · João Vicente e Hanna", "Rios e Águas · Alice e Giulle", "Autocuidado · Simone e Vanessa", "Dança Charme · Luciana Reis e Wellington", "Cosmogonias e Comics · Grossi e Waleska", "Empreendedorismo · Patrícia e Luiza", "Geisa e Sharon", "Lugares inclusivos · Anastasiya e Lasneaux"] },
  { k: "OFTEC", t: "Oficinas Técnicas", q: 30, o: ["Fundamentos", "Comunicação, Marketing", "Segurança e Gestão de Riscos", "Turismo, Cultura e Desenvolvimento", "Diversidade e Relações Étnico-Raciais", "Gestão de Pessoas, Liderança"] },
];

// Matrículas da coordenação (o acesso também exige a senha COORD_SENHA).
export const COORDENACAO = { "1651799": "Glauco Vaz Feijo" };

export const AV = "avaliação", IN = "inscrito", EX = "excedido";

export const codigo = (c, i) => c.k + " " + String(i + 1).padStart(2, "0");

// Ofertas que um estudante do ano "y" pode escolher (OFTEC 01 é só para ingressantes).
export const ofertas = (c, y) =>
  c.o.map((d, i) => [codigo(c, i), d]).filter(([x]) => !(x === "OFTEC 01" && y !== 1));
