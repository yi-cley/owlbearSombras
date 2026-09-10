// schema.js
// Modelo de dados de fichas de Sombras de Victoria (hack de City of Mist).
// Chaves curtas de propósito: a metadata da sala no Owlbear tem limite de 16kB
// TOTAL, compartilhado com todas as extensões da sala — não é só nosso espaço.
//
// MAPEAMENTO (conferido na planilha de referência):
//   Vertente = Mythos → pergunta de Mistério, trilha de Fade
//   Cerne    = Logos  → pergunta de Identidade, trilha de Crack
//
// Duas "formas" de ficha convivem no mesmo armazenamento, diferenciadas por
// `tipo`: "pc" (a ficha de personagem já existente) e "danger" (Danger
// Profile — perfil de ameaça/NPC do MC, estrutura bem mais enxuta).

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
  // Tracking card: status/tag temporário com trilha numerada 1-6 (OUT/MC nas pontas).
  // `revelado` controla se esse status aparece no balão do token no mapa
  // (ver mapa.js) — por padrão nasce escondido, o MC decide quando mostrar.
  return { id: gerarId(), tag: "", tier: 0, revelado: false };
}

export function novoSpectrum() {
  // Spectrum de uma Danger: uma tag + o tier máximo que a "vence" por aquele
  // caminho (lutar, convencer, banir...). `contagem` marca um spectrum tipo
  // "countdown" (enche até estourar um movimento, em vez de "derrotar").
  return { id: gerarId(), tag: "", tierMax: 3, contagem: false };
}

export function novoMovimento(tipo) {
  // tipo: "suave" | "duro" | "intrusao" | "passivo"
  return { id: gerarId(), tipo: tipo || "duro", texto: "" };
}

function camposVinculo() {
  // Comuns a PC e Danger: vínculo leve com um token do mapa (não é o
  // Método 2 — a ficha continua morando na metadata da sala, só ganha uma
  // referência de token pra exibir retrato/rastreios revelados nele).
  return { tokenId: null, labelItemId: null };
}

export function novaFicha(nome) {
  return {
    id: gerarId(),
    tipo: "pc",
    nome: nome || "Novo Personagem",
    jogador: "",
    crew: [],          // lista de membros da crew
    storyTags: [],     // lista de story tags
    buildUp: 0,        // trilha Build-Up, 0-4
    fluxo: 0,          // Juice — recurso que os jogadores tendem a esquecer de rastrear
    mostrarFluxo: false, // opcional: só aparece no balão do token quando ligado
    momentos: [],      // Moments of Evolution: [{ texto, feito }]
    nemesis: "",
    temas: [
      novoTema("vertente"),
      novoTema("vertente"),
      novoTema("cerne"),
      novoTema("cerne")
    ],
    rastreios: [],
    ...camposVinculo()
  };
}

export function novaAmeaca(nome) {
  return {
    id: gerarId(),
    tipo: "danger",
    nome: nome || "Nova Ameaça",
    descricao: "",       // persona narrativa, numa frase ou duas
    classificacao: 1,     // Danger Rating, 1-5
    tamanhoColetivo: null, // null = individual; 1-4 = coletivo
    spectrums: [novoSpectrum()],
    storyTags: [],
    rastreios: [],
    movimentos: [],       // [{ id, tipo, texto }]
    defesas: [],          // [texto]
    ...camposVinculo()
  };
}

export function dadosVazios() {
  return { chars: {}, ordem: [] };
}

// --- Migração de fichas antigas ---
// Fichas criadas antes desta versão não tinham `tipo`, tinham `crew`/`storyTags`
// como texto simples, ou podiam não ter todos os campos novos. Isso normaliza
// sem perder nada do que já foi escrito.
export function normalizarFicha(f) {
  if (!f) return f;

  if (f.tipo !== "danger") f.tipo = "pc"; // qualquer coisa antiga vira "pc"

  if (typeof f.crew === "string") {
    f.crew = f.crew.trim() ? [f.crew.trim()] : [];
  }
  if (!Array.isArray(f.crew)) f.crew = [];

  if (typeof f.storyTags === "string") {
    f.storyTags = f.storyTags.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (!Array.isArray(f.storyTags)) f.storyTags = [];

  if (!Array.isArray(f.rastreios)) f.rastreios = [];
  f.rastreios.forEach((r) => {
    if (!r.id) r.id = gerarId();
    if (typeof r.tier !== "number") r.tier = 0;
    if (typeof r.revelado !== "boolean") r.revelado = false;
  });

  if (f.tokenId === undefined) f.tokenId = null;
  if (f.labelItemId === undefined) f.labelItemId = null;

  if (f.tipo === "danger") {
    if (typeof f.descricao !== "string") f.descricao = "";
    if (typeof f.classificacao !== "number") f.classificacao = 1;
    if (f.tamanhoColetivo !== null && typeof f.tamanhoColetivo !== "number") f.tamanhoColetivo = null;
    if (!Array.isArray(f.spectrums)) f.spectrums = [];
    f.spectrums.forEach((s) => {
      if (!s.id) s.id = gerarId();
      if (typeof s.tierMax !== "number") s.tierMax = 3;
      if (typeof s.contagem !== "boolean") s.contagem = false;
    });
    if (!Array.isArray(f.movimentos)) f.movimentos = [];
    f.movimentos.forEach((m) => {
      if (!m.id) m.id = gerarId();
      if (!["suave", "duro", "intrusao", "passivo"].includes(m.tipo)) m.tipo = "duro";
    });
    if (!Array.isArray(f.defesas)) f.defesas = [];
    return f;
  }

  // --- normalização específica de PC ---
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
  if (!Array.isArray(f.momentos)) f.momentos = [];
  if (typeof f.buildUp !== "number") f.buildUp = 0;
  if (typeof f.fluxo !== "number") f.fluxo = 0;
  if (typeof f.mostrarFluxo !== "boolean") f.mostrarFluxo = false;

  return f;
}

export function normalizarDados(dados) {
  if (!dados || typeof dados !== "object") return dadosVazios();
  if (!dados.chars) dados.chars = {};
  if (!Array.isArray(dados.ordem)) dados.ordem = [];
  Object.values(dados.chars).forEach(normalizarFicha);
  return dados;
}
