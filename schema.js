// schema.js
// Modelo de dados de uma ficha de Sombras de Victoria (hack de City of Mist).
// Chaves curtas de propósito: a metadata da sala no Owlbear tem limite de 16kB
// TOTAL, compartilhado com todas as extensões da sala — não é só nosso espaço.

export function gerarId() {
  return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
}

export function novoTema(grupo) {
  // grupo: "cerne" (equivalente a Mythos) ou "vertente" (equivalente a Logos)
  return {
    id: gerarId(),
    grupo,
    tipo: "",         // ex: "Vertente de Doll", "Fora da Cerne: Herança"
    titulo: "",        // nome do tema
    atencao: 0,        // trilha Attention, 0-4
    fadeCrack: 0,      // Fade (cerne) ou Crack (vertente), 0-4
    pergunta: "",      // Mystery (cerne) / Identity (vertente)
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
    crew: "",
    storyTags: "",
    buildUp: 0,       // trilha Build-Up, 0-4
    momentos: [],      // Moments of Evolution: [{ texto, feito }]
    nemesis: "",
    temas: [
      novoTema("cerne"),
      novoTema("cerne"),
      novoTema("vertente"),
      novoTema("vertente")
    ],
    rastreios: []
  };
}

export function dadosVazios() {
  return { chars: {}, ordem: [] };
}
