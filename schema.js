// schema.js
// Modelo de dados de uma ficha de Sombras de Victoria (hack de City of Mist).
// Chaves curtas de propósito: a metadata da sala no Owlbear tem limite de 16kB
// TOTAL, compartilhado com todas as extensões da sala — não é só nosso espaço.
//
// MAPEAMENTO (conferido na planilha de referência):
//   Vertente = Mythos → pergunta de Mistério, trilha de Fade
//   Cerne    = Logos  → pergunta de Identidade, trilha de Crack

export function gerarId() {
  return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
}

export function novoTema(grupo) {
  // grupo: "vertente" (Mythos) ou "cerne" (Logos)
  return {
    id: gerarId(),
    grupo,
    tipo: "",         // ex: "Vertente de Doll", "Função no Mundo"
    titulo: "",        // nome do tema
    atencao: 0,        // trilha Attention, 0-4
    fadeCrack: 0,      // Fade (vertente) ou Crack (cerne), 0-4
    pergunta: "",      // Mistério (vertente) / Identidade (cerne)
    descricao: "",
    tagsPoder: [],     // [{ texto, queimada }]
    tagsFraqueza: [],  // [{ texto, invocada }]
    melhorias: [],     // [texto]
    flipside: ""
  };
}

export function novoRastreio() {
  // Tracking card: status/tag temporário com trilha numerada 1-6 (OUT/MC nas pontas)
  return { id: gerarId(), tag: "", tier: 0 };
}

export function novaFicha(nome) {
  return {
    id: gerarId(),
    nome: nome || "Novo Personagem",
    jogador: "",
    crew: [],          // lista de membros da crew
    storyTags: [],     // lista de story tags
    buildUp: 0,        // trilha Build-Up, 0-4
    momentos: [],      // Moments of Evolution: [{ texto, feito }]
    nemesis: "",
    temas: [
      novoTema("vertente"),
      novoTema("vertente"),
      novoTema("cerne"),
      novoTema("cerne")
    ],
    rastreios: []
  };
}

export function dadosVazios() {
  return { chars: {}, ordem: [] };
}

// --- Migração de fichas antigas ---
// Fichas criadas antes desta versão tinham `crew` e `storyTags` como texto
// simples, e podem não ter todos os campos de tema. Isso normaliza sem perder
// nada do que já foi escrito.
export function normalizarFicha(f) {
  if (!f) return f;

  if (typeof f.crew === "string") {
    f.crew = f.crew.trim() ? [f.crew.trim()] : [];
  }
  if (!Array.isArray(f.crew)) f.crew = [];

  if (typeof f.storyTags === "string") {
    f.storyTags = f.storyTags.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (!Array.isArray(f.storyTags)) f.storyTags = [];

  if (!Array.isArray(f.temas)) f.temas = [];
  f.temas.forEach((t) => {
    if (!t.id) t.id = gerarId();
    if (t.grupo !== "cerne" && t.grupo !== "vertente") t.grupo = "cerne";
    if (!Array.isArray(t.tagsPoder)) t.tagsPoder = [];
    if (!Array.isArray(t.tagsFraqueza)) t.tagsFraqueza = [];
    if (!Array.isArray(t.melhorias)) t.melhorias = [];
    if (typeof t.atencao !== "number") t.atencao = 0;
    if (typeof t.fadeCrack !== "number") t.fadeCrack = 0;
  });

  if (!Array.isArray(f.rastreios)) f.rastreios = [];
  if (!Array.isArray(f.momentos)) f.momentos = [];
  if (typeof f.buildUp !== "number") f.buildUp = 0;

  return f;
}

export function normalizarDados(dados) {
  if (!dados || typeof dados !== "object") return dadosVazios();
  if (!dados.chars) dados.chars = {};
  if (!Array.isArray(dados.ordem)) dados.ordem = [];
  Object.values(dados.chars).forEach(normalizarFicha);
  return dados;
}
