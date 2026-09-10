import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3.1.0";
import { novaFicha, novoTema, novoRastreio, novoSpectrum, novoMovimento, novaAmeaca, normalizarFicha, gerarId } from "./schema.js";
import { carregarFichas, salvarFichas, aoMudarFichas, checarTamanho, marcarPresenca, limparPresenca, aoMudarPresenca, presencaInicial } from "./storage.js";
import { tokenSelecionadoAgora, vincularToken, desvincularToken, removerLabel } from "./mapa.js";
import { MOVES_ACAO, MOVES_SESSAO, MOVES_VERTENTE, MOVES_CERNE } from "./moves.js";

const ROSTER_W = 340, ROSTER_H = 480;
const SHEET_W = 900, SHEET_H = 680;
const MOVES_W = 480, MOVES_H = 640;

// Vertente = Mythos (Mistério / Fade) · Cerne = Logos (Identidade / Crack)
const CONFIG_GRUPO = {
  vertente: { rotulo: "Vertente", pergunta: "Mistério", trilha2: "Fade" },
  cerne:    { rotulo: "Cerne",    pergunta: "Identidade", trilha2: "Crack" }
};

const app = document.getElementById("app");

const estado = {
  view: "roster",
  dados: { chars: {}, ordem: [] },
  atualId: null,
  editando: false,
  confirmarExclusao: new Set(), // ids de ficha "armados" pra exclusão (2º clique confirma)
  modoEdicao: false,            // false = só leitura; true = campos liberados
  presencaAtiva: {},            // { fichaId: { nome, id, ts } } — quem está vendo o quê agora
  abaAtual: "pc",                // "pc" | "danger" — só relevante pro GM
  souGM: false,
  confirmarRemocao: new Set(),   // chaves "tema:<id>" / "spectrum:<idx>" armadas pra remoção
  filtroTexto: "",               // busca do roster
};
const timersExclusao = new Map();
const timersRemocao = new Map();
let heartbeatPresenca = null;

let salvarTimer = null;
let statusTimer = null;
function setStatusSalvamento(texto, classe) {
  const el = document.getElementById("status-salvamento");
  if (!el) return; // só existe na tela de ficha
  el.textContent = texto;
  el.className = "status-salvamento" + (classe ? " " + classe : "");
}
function agendarSalvar() {
  clearTimeout(salvarTimer);
  clearTimeout(statusTimer);
  setStatusSalvamento("● salvando...", "salvando");
  salvarTimer = setTimeout(async () => {
    await salvarFichas(estado.dados);
    setStatusSalvamento("✓ salvo", "salvo");
    statusTimer = setTimeout(() => setStatusSalvamento("", ""), 1500);
  }, 400);
}

// Salva imediatamente, sem debounce — usado antes de qualquer transição que
// redimensiona o popover (ex: abrir uma ficha recém-criada). No celular, esse
// redimensionamento pode fazer o painel recarregar; se isso acontecer antes do
// debounce normal disparar, uma ficha recém-criada se perde por nunca ter sido
// escrita de fato na sala. Salvar antes de navegar evita essa corrida.
async function salvarAgora() {
  clearTimeout(salvarTimer);
  clearTimeout(statusTimer);
  setStatusSalvamento("● salvando...", "salvando");
  await salvarFichas(estado.dados);
  setStatusSalvamento("✓ salvo", "salvo");
  statusTimer = setTimeout(() => setStatusSalvamento("", ""), 1500);
}

function esc(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function fichaAtual() {
  return estado.dados.chars[estado.atualId];
}

// Padrão genérico de "1º clique arma, 2º confirma" (o mesmo já usado pra
// excluir ficha), reaproveitado aqui pra remover tema e spectrum. Retorna
// true se essa foi a confirmação de verdade (quem chamou deve remover);
// false se só armou o botão (quem chamou deve parar e re-renderizar).
function confirmarOuArmar(chave) {
  if (!estado.confirmarRemocao.has(chave)) {
    estado.confirmarRemocao.add(chave);
    clearTimeout(timersRemocao.get(chave));
    timersRemocao.set(chave, setTimeout(() => {
      estado.confirmarRemocao.delete(chave);
      timersRemocao.delete(chave);
      if (estado.view === "sheet") renderSheet();
    }, 3000));
    return false;
  }
  clearTimeout(timersRemocao.get(chave));
  timersRemocao.delete(chave);
  estado.confirmarRemocao.delete(chave);
  return true;
}

// ---------- textareas que crescem com o conteúdo ----------
function ajustarTextarea(el) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}
function ajustarTodasTextareas() {
  app.querySelectorAll("textarea").forEach(ajustarTextarea);
}

// ---------- aviso de tamanho ----------
function avisoTamanhoHtml() {
  const { perto, bytes, limite } = checarTamanho(estado.dados);
  if (!perto) return "";
  return `<div class="aviso">Os dados comprimidos estão em ${bytes} de ${limite} bytes (limite compartilhado com outras extensões da sala). Considere encurtar descrições ou remover fichas não usadas.</div>`;
}

// ---------- referência rápida de moves ----------
function renderMoveCard(m) {
  return `
    <div class="move-card">
      <div class="move-titulo">${esc(m.titulo)}</div>
      <div class="move-gatilho">${esc(m.gatilho)}</div>
      <div class="move-efeito">${esc(m.efeito)}</div>
    </div>`;
}
function renderMoves() {
  app.innerHTML = `
    <div class="linha-topo-ficha">
      <button class="voltar" data-action="voltar">← Voltar</button>
    </div>
    <h2 class="moves-secao-titulo">Moves de Ação</h2>
    ${MOVES_ACAO.map(renderMoveCard).join("")}
    <h2 class="moves-secao-titulo">Sessão &amp; Entreatos</h2>
    ${MOVES_SESSAO.map(renderMoveCard).join("")}
    <h2 class="moves-secao-titulo vertente">Vertente</h2>
    ${MOVES_VERTENTE.map(renderMoveCard).join("")}
    <h2 class="moves-secao-titulo cerne">Cerne</h2>
    ${MOVES_CERNE.map(renderMoveCard).join("")}
  `;
}

// ---------- roster ----------
function renderRoster() {
  if (!estado.souGM) estado.abaAtual = "pc"; // segurança extra: jogador nunca fica preso numa aba de Ameaça

  const ids = estado.dados.ordem.filter((id) => {
    const f = estado.dados.chars[id];
    if (!f) return false;
    if (!estado.souGM) return f.tipo !== "danger"; // jogador nunca vê Ameaças, seja qual for a aba
    return (f.tipo === "danger") === (estado.abaAtual === "danger");
  });

  const itens = ids.length
    ? ids.map((id) => {
        const f = estado.dados.chars[id];
        const ehAmeaca = f.tipo === "danger";
        const resumo = ehAmeaca
          ? (f.spectrums || []).map((s) => s.tag).filter(Boolean).join(" · ")
          : (f.temas || []).map((t) => t.titulo).filter(Boolean).join(" · ");
        const subtitulo = ehAmeaca ? `Classificação ${f.classificacao || 1}★` : (f.jogador || "sem jogador");
        const armado = estado.confirmarExclusao.has(id);
        const presenca = estado.presencaAtiva[id];
        const buscaTexto = esc(`${f.nome} ${subtitulo} ${resumo}`.toLowerCase());
        return `
          <div class="roster-item" data-action="abrir" data-id="${id}" data-busca-texto="${buscaTexto}">
            <div>
              <div class="nome">${esc(f.nome)}</div>
              <div class="sub">${esc(subtitulo)}${resumo ? " — " + esc(resumo) : ""}</div>
              ${presenca ? `<div class="badge-presenca">✎ ${esc(presenca.nome)} está aqui agora</div>` : ""}
            </div>
            <button data-action="excluir" data-id="${id}" class="excluir-mini ${armado ? "armado" : ""}">${armado ? "Confirmar?" : "✕"}</button>
          </div>`;
      }).join("")
    : `<div class="vazio">${estado.abaAtual === "danger" ? "Nenhuma ameaça ainda." : "Nenhuma ficha ainda."} Crie a primeira abaixo.</div>`;

  const abas = estado.souGM ? `
    <div class="abas-roster">
      <button data-action="aba" data-aba="pc" class="${estado.abaAtual === "pc" ? "aba-ativa" : ""}">Personagens</button>
      <button data-action="aba" data-aba="danger" class="${estado.abaAtual === "danger" ? "aba-ativa" : ""}">Ameaças</button>
    </div>` : "";

  const botaoNovo = estado.abaAtual === "danger"
    ? `<button data-action="nova-ameaca" class="primario">+ Nova Ameaça</button>`
    : `<button data-action="nova" class="primario">+ Nova Ficha</button>`;

  app.innerHTML = `
    ${avisoTamanhoHtml()}
    <div class="roster-header">
      <h2>Fichas de Sombras</h2>
      <button data-action="ver-moves" title="Referência rápida de moves">📖 Moves</button>
    </div>
    ${abas}
    ${ids.length > 4 ? `<input type="text" class="busca-roster" placeholder="Buscar..." value="${esc(estado.filtroTexto)}" data-busca-roster />` : ""}
    <div>${itens}</div>
    <div class="linha-botoes">
      ${botaoNovo}
      <button data-action="importar">⇩ Importar JSON</button>
    </div>
  `;
  aplicarFiltroRoster();
}

// Filtra os itens do roster já renderizados sem re-renderizar (evita perder
// o foco/cursor de quem está digitando na busca).
function aplicarFiltroRoster() {
  const filtro = estado.filtroTexto.trim().toLowerCase();
  app.querySelectorAll(".roster-item").forEach((el) => {
    const texto = el.dataset.buscaTexto || "";
    el.classList.toggle("oculto-filtro", !!filtro && !texto.includes(filtro));
  });
}

// ---------- trilha de pips ----------
function renderTrilha(valor, max, path, cor) {
  let html = `<div class="trilha" data-path="${path}" data-max="${max}">`;
  for (let i = 0; i < max; i++) {
    html += `<span class="pip ${i < valor ? "cheio " + cor : ""}" data-pip-idx="${i}"></span>`;
  }
  return html + `</div>`;
}

// ---------- lista simples de textos (crew, story tags) ----------
function renderListaSimples(campo, itens, placeholder, rotuloBotao) {
  const linhas = (itens || []).map((txt, idx) => `
    <div class="tag-item">
      <input type="text" value="${esc(txt)}" placeholder="${placeholder}" data-lista="${campo}" data-idx="${idx}" />
      <button data-action="remover-lista" data-lista="${campo}" data-idx="${idx}">✕</button>
    </div>`).join("");
  return `<div class="lista-tags">${linhas}</div>
    <button data-action="add-lista" data-lista="${campo}" class="add-mini">${rotuloBotao}</button>`;
}

// ---------- tags de poder / fraqueza ----------
function renderTags(temaId, lista, tipo) {
  const ehPoder = tipo === "poder";
  const flag = ehPoder ? "queimada" : "invocada";
  const icone = ehPoder ? "🔥" : "⚑";
  const titulo = ehPoder ? "Queimada" : "Invocada";

  const linhas = (lista || []).map((tag, idx) => `
    <div class="tag-item">
      <button class="marca ${tag[flag] ? "ativa" : ""}" title="${titulo}"
        data-tag-toggle data-tema-id="${temaId}" data-tipo="${tipo}" data-idx="${idx}">${icone}</button>
      <input type="text" value="${esc(tag.texto)}" placeholder="Texto da tag" class="${tag[flag] ? "marcada" : ""}"
        data-tag-texto data-tema-id="${temaId}" data-tipo="${tipo}" data-idx="${idx}" />
      <button data-action="remover-tag" data-tema-id="${temaId}" data-tipo="${tipo}" data-idx="${idx}">✕</button>
    </div>`).join("");

  return `<div class="lista-tags">${linhas}</div>
    <button data-action="add-tag" data-tema-id="${temaId}" data-tipo="${tipo}" class="add-mini">+ tag</button>`;
}

// ---------- um tema ----------
function renderTema(t) {
  const cfg = CONFIG_GRUPO[t.grupo];
  const outro = t.grupo === "cerne" ? "Vertente" : "Cerne";
  const armado = estado.confirmarRemocao.has(`tema:${t.id}`);
  return `
    <div class="tema-card ${t.grupo}" data-tema-id="${t.id}">
      <div class="tema-topo">
        <span class="rotulo">${cfg.rotulo}</span>
        <div class="tema-acoes">
          <button data-action="trocar-grupo" data-tema-id="${t.id}" title="Converter para ${outro}">⇄ ${outro}</button>
          <button data-action="remover-tema" data-tema-id="${t.id}" class="perigo ${armado ? "armado-inline" : ""}" title="Remover tema">${armado ? "Confirmar?" : "✕"}</button>
        </div>
      </div>
      <div class="campo">
        <label>Tipo</label>
        <input type="text" value="${esc(t.tipo)}" data-field="tipo" data-tema-id="${t.id}" placeholder="ex: Vertente de Doll" />
      </div>
      <div class="campo">
        <label>Título do Tema</label>
        <input type="text" value="${esc(t.titulo)}" data-field="titulo" data-tema-id="${t.id}" class="titulo-tema" />
      </div>
      <div class="linha">
        <div class="campo">
          <label>Attention</label>
          ${renderTrilha(t.atencao, 4, `tema:${t.id}:atencao`, t.grupo)}
        </div>
        <div class="campo">
          <label>${cfg.trilha2}</label>
          ${renderTrilha(t.fadeCrack, 4, `tema:${t.id}:fadeCrack`, "danger")}
        </div>
      </div>
      <div class="campo">
        <label>${cfg.pergunta}</label>
        <textarea data-field="pergunta" data-tema-id="${t.id}" rows="1">${esc(t.pergunta)}</textarea>
      </div>
      <div class="campo">
        <label>Descrição</label>
        <textarea data-field="descricao" data-tema-id="${t.id}" rows="1">${esc(t.descricao)}</textarea>
      </div>
      <div class="campo">
        <label>Power Tags</label>
        ${renderTags(t.id, t.tagsPoder, "poder")}
      </div>
      <div class="campo">
        <label>Weakness Tags</label>
        ${renderTags(t.id, t.tagsFraqueza, "fraqueza")}
      </div>
      <div class="campo">
        <label>Flipside</label>
        <textarea data-field="flipside" data-tema-id="${t.id}" rows="1">${esc(t.flipside)}</textarea>
      </div>
    </div>`;
}

// ---------- rastreios ----------
function renderRastreios(f) {
  const linhas = (f.rastreios || []).map((r, idx) => `
    <div class="rastreio-item">
      <input type="text" value="${esc(r.tag)}" placeholder="Nome do status" data-rastreio-field="tag" data-idx="${idx}" style="max-width:180px;" />
      ${renderTrilha(r.tier, 6, `rastreio:${idx}:tier`, "danger")}
      <button data-action="remover-rastreio" data-idx="${idx}" class="perigo">✕</button>
    </div>`).join("");
  return `${linhas}<button data-action="add-rastreio" class="add-mini">+ Status</button>`;
}

// ---------- vínculo com token (comum a PC e Ameaça) ----------
function renderVinculoToken(f) {
  if (f.tokenId) {
    return `
      <div class="campo">
        <label>Token no mapa</label>
        <div class="vinculo-linha">
          <span class="vinculo-status">🔗 vinculado a um token</span>
          <button data-action="desvincular-token">Desvincular</button>
        </div>
      </div>`;
  }
  return `
    <div class="campo">
      <label>Token no mapa</label>
      <div class="vinculo-linha">
        <button data-action="vincular-token">🔗 Vincular token selecionado</button>
      </div>
    </div>`;
}

// ---------- spectrums (Ameaça) ----------
function renderSpectrum(s, idx) {
  const armado = estado.confirmarRemocao.has(`spectrum:${idx}`);
  return `
    <div class="spectrum-item">
      <input type="text" value="${esc(s.tag)}" placeholder="ex: convencido-ou-fugiu" data-spectrum-idx="${idx}" data-field="tag" />
      <label class="spectrum-max">até tier
        <input type="number" min="1" max="6" value="${s.tierMax}" data-spectrum-idx="${idx}" data-field="tierMax" />
      </label>
      <label class="spectrum-check">
        <input type="checkbox" ${s.contagem ? "checked" : ""} data-spectrum-idx="${idx}" data-field="contagem" /> countdown
      </label>
      <button data-action="remover-spectrum" data-idx="${idx}" class="perigo ${armado ? "armado-inline" : ""}">${armado ? "Confirmar?" : "✕"}</button>
    </div>`;
}
function renderSpectrums(f) {
  const linhas = (f.spectrums || []).map((s, idx) => renderSpectrum(s, idx)).join("");
  return `${linhas}<button data-action="add-spectrum" class="add-mini">+ Spectrum</button>`;
}

// ---------- movimentos (Ameaça) ----------
const ROTULOS_MOVIMENTO = { suave: "Suave", duro: "Duro", intrusao: "Intrusão", passivo: "Passivo" };
function renderMovimento(m, idx) {
  const opcoes = Object.entries(ROTULOS_MOVIMENTO)
    .map(([v, l]) => `<option value="${v}" ${m.tipo === v ? "selected" : ""}>${l}</option>`).join("");
  return `
    <div class="movimento-item">
      <select class="movimento-tipo ${m.tipo}" data-mov-idx="${idx}" data-field="tipo">${opcoes}</select>
      <textarea data-mov-idx="${idx}" data-field="texto" rows="1" placeholder="Descreva o movimento...">${esc(m.texto)}</textarea>
      <button data-action="remover-movimento" data-idx="${idx}" class="perigo">✕</button>
    </div>`;
}
function renderMovimentos(f) {
  const linhas = (f.movimentos || []).map((m, idx) => renderMovimento(m, idx)).join("");
  return `${linhas}<button data-action="add-movimento" class="add-mini">+ Movimento</button>`;
}

// ---------- ficha completa: Ameaça (Danger) ----------
function renderFichaAmeaca(f) {
  app.innerHTML = `
    ${avisoTamanhoHtml()}
    <div class="linha-topo-ficha">
      <button class="voltar" data-action="voltar">← Voltar</button>
      <span id="status-salvamento" class="status-salvamento"></span>
      <div class="topo-acoes-direita">
        <button data-action="ver-moves" title="Referência rápida de moves">📖</button>
        <button data-action="alternar-edicao">${estado.modoEdicao ? "🔒 Bloquear edição" : "✏️ Editar"}</button>
        <button data-action="duplicar" data-id="${f.id}" title="Duplicar ficha">⎘ Duplicar</button>
        <button data-action="exportar" data-id="${f.id}">⇧ Exportar JSON</button>
      </div>
    </div>
    <div class="ficha-corpo ${estado.modoEdicao ? "" : "bloqueada"}">
    <div class="sheet-header">
      <div class="campo"><label>Nome</label><input type="text" value="${esc(f.nome)}" data-field="nome" /></div>
      <div class="campo">
        <label>Descrição / persona</label>
        <textarea data-field="descricao" rows="1">${esc(f.descricao)}</textarea>
      </div>
      <div class="linha">
        <div class="campo">
          <label>Danger Rating</label>
          ${renderTrilha(f.classificacao, 5, "classificacao", "danger")}
        </div>
        <div class="campo">
          <label>Fator de Coletivo (opcional)</label>
          <input type="number" min="1" max="4" placeholder="individual" value="${f.tamanhoColetivo ?? ""}" data-field="tamanhoColetivo" style="max-width:110px;" />
        </div>
      </div>
      ${renderVinculoToken(f)}
    </div>

    <div class="secao-titulo"><h3>Spectrums</h3></div>
    ${renderSpectrums(f)}

    <div class="secao-titulo"><h3>Story Tags iniciais</h3></div>
    ${renderListaSimples("storyTags", f.storyTags, "Story tag", "+ story tag")}

    <div class="secao-titulo"><h3>Tracking Cards</h3></div>
    ${renderRastreios(f)}

    <div class="secao-titulo"><h3>Movimentos</h3></div>
    ${renderMovimentos(f)}

    <div class="secao-titulo"><h3>Defesas</h3></div>
    ${renderListaSimples("defesas", f.defesas, "Defesa", "+ defesa")}
    </div>
  `;
  ajustarTodasTextareas();
}

// ---------- Moments of Evolution ----------
function renderMomentos(f) {
  const linhas = (f.momentos || []).map((m, idx) => `
    <div class="tag-item">
      <input type="checkbox" data-momento-idx="${idx}" data-momento-check ${m.feito ? "checked" : ""} />
      <input type="text" value="${esc(m.texto)}" placeholder="Descreva o momento de evolução..." class="${m.feito ? "marcada" : ""}" data-momento-idx="${idx}" data-momento-texto />
      <button data-action="remover-momento" data-idx="${idx}">✕</button>
    </div>`).join("");
  return `<div class="lista-tags">${linhas}</div>
    <button data-action="add-momento" class="add-mini">+ Momento</button>`;
}

// ---------- ficha completa: Personagem (PC) ----------
function renderSheet() {
  const f = fichaAtual();
  if (!f) { estado.view = "roster"; return renderRoster(); }
  if (f.tipo === "danger") return renderFichaAmeaca(f);

  const vertentes = f.temas.filter((t) => t.grupo === "vertente");
  const cernes = f.temas.filter((t) => t.grupo === "cerne");

  app.innerHTML = `
    ${avisoTamanhoHtml()}
    <div class="linha-topo-ficha">
      <button class="voltar" data-action="voltar">← Voltar</button>
      <span id="status-salvamento" class="status-salvamento"></span>
      <div class="topo-acoes-direita">
        <button data-action="ver-moves" title="Referência rápida de moves">📖</button>
        <button data-action="alternar-edicao">${estado.modoEdicao ? "🔒 Bloquear edição" : "✏️ Editar"}</button>
        <button data-action="duplicar" data-id="${f.id}" title="Duplicar ficha">⎘ Duplicar</button>
        <button data-action="exportar" data-id="${f.id}">⇧ Exportar JSON</button>
      </div>
    </div>
    <div class="ficha-corpo ${estado.modoEdicao ? "" : "bloqueada"}">
    <div class="sheet-header">
      <div class="linha">
        <div class="campo"><label>Nome</label><input type="text" value="${esc(f.nome)}" data-field="nome" /></div>
        <div class="campo"><label>Jogador</label><input type="text" value="${esc(f.jogador)}" data-field="jogador" /></div>
      </div>
      <div class="linha">
        <div class="campo">
          <label>Crew</label>
          ${renderListaSimples("crew", f.crew, "Nome do membro", "+ membro")}
        </div>
        <div class="campo">
          <label>Story Tags</label>
          ${renderListaSimples("storyTags", f.storyTags, "Story tag", "+ story tag")}
        </div>
      </div>
      <div class="linha">
        <div class="campo">
          <label>Build-Up</label>
          ${renderTrilha(f.buildUp, 4, "buildUp", "")}
        </div>
        <div class="campo">
          <label>Fluxo (Juice)</label>
          <div class="contador">
            <button data-action="fluxo-menos">−</button>
            <span class="contador-valor">${f.fluxo || 0}</span>
            <button data-action="fluxo-mais">+</button>
          </div>
          <label class="fluxo-mostrar">
            <input type="checkbox" ${f.mostrarFluxo ? "checked" : ""} data-field-check="mostrarFluxo" /> mostrar no balão do token
          </label>
        </div>
      </div>
      <div class="campo"><label>Nemesis</label><input type="text" value="${esc(f.nemesis)}" data-field="nemesis" /></div>
      ${renderVinculoToken(f)}
    </div>

    <div class="secao-titulo"><h3>Moments of Evolution</h3></div>
    ${renderMomentos(f)}

    <div class="duas-colunas">
      <div class="coluna">
        <div class="coluna-titulo vertente">Vertente</div>
        ${vertentes.map(renderTema).join("")}
        <button data-action="add-tema" data-grupo="vertente" class="add-mini">+ Tema de Vertente</button>
      </div>
      <div class="divisoria"></div>
      <div class="coluna">
        <div class="coluna-titulo cerne">Cerne</div>
        ${cernes.map(renderTema).join("")}
        <button data-action="add-tema" data-grupo="cerne" class="add-mini">+ Tema de Cerne</button>
      </div>
    </div>

    <div class="secao-titulo"><h3>Tracking Cards</h3></div>
    ${renderRastreios(f)}
    </div>
  `;
  ajustarTodasTextareas();
}

// ---------- exportar / importar ficha em JSON ----------
function nomeArquivoSeguro(nome) {
  return (nome || "ficha")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "ficha";
}

function exportarFicha(ficha) {
  if (!ficha) return;
  const json = JSON.stringify(ficha, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nomeArquivoSeguro(ficha.nome)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function pareceUmaFicha(obj) {
  return obj && typeof obj === "object" && (Array.isArray(obj.temas) || Array.isArray(obj.spectrums));
}

function importarFicha() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.addEventListener("change", () => {
    const arquivo = input.files[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = async () => {
      let ficha;
      try {
        ficha = JSON.parse(leitor.result);
      } catch {
        alert("Esse arquivo não é um JSON válido.");
        return;
      }
      if (!pareceUmaFicha(ficha)) {
        alert("Esse JSON não parece ser uma ficha de Sombras (faltam os temas ou os spectrums).");
        return;
      }
      ficha = normalizarFicha(ficha);
      ficha.id = gerarId(); // sempre um ID novo, pra nunca colidir com uma ficha existente
      estado.dados.chars[ficha.id] = ficha;
      estado.dados.ordem.push(ficha.id);
      estado.abaAtual = ficha.tipo === "danger" ? "danger" : "pc";
      await salvarAgora();
      irPara("sheet", ficha.id, true);
    };
    leitor.readAsText(arquivo);
  });
  input.click();
}

function render() {
  if (estado.view === "roster") renderRoster();
  else if (estado.view === "moves") renderMoves();
  else renderSheet();
}

async function irPara(view, id, modoEdicaoInicial) {
  // saindo de uma ficha: para o heartbeat e libera minha presença
  if (estado.view === "sheet" && estado.atualId && (view !== "sheet" || id !== estado.atualId)) {
    clearInterval(heartbeatPresenca);
    heartbeatPresenca = null;
    limparPresenca().catch(() => {});
  }

  estado.view = view;
  estado.atualId = id || null;
  estado.modoEdicao = view === "sheet" ? !!modoEdicaoInicial : false;

  if (view === "sheet") {
    await OBR.action.setWidth(SHEET_W);
    await OBR.action.setHeight(SHEET_H);
    marcarPresenca(id).catch(() => {});
    heartbeatPresenca = setInterval(() => marcarPresenca(id).catch(() => {}), 6000);
  } else if (view === "moves") {
    await OBR.action.setWidth(MOVES_W);
    await OBR.action.setHeight(MOVES_H);
  } else {
    await OBR.action.setWidth(ROSTER_W);
    await OBR.action.setHeight(ROSTER_H);
  }
  render();
}

// ---------- eventos ----------
app.addEventListener("focusin", (e) => {
  if (e.target.matches("input, textarea")) estado.editando = true;
});
app.addEventListener("focusout", (e) => {
  if (e.target.matches("input, textarea")) estado.editando = false;
});

app.addEventListener("click", (e) => {
  const f = fichaAtual();

  // marcador de burn / invoke
  const marca = e.target.closest("[data-tag-toggle]");
  if (marca) {
    const tema = f.temas.find((t) => t.id === marca.dataset.temaId);
    const ehPoder = marca.dataset.tipo === "poder";
    const campo = ehPoder ? "tagsPoder" : "tagsFraqueza";
    const flag = ehPoder ? "queimada" : "invocada";
    const tag = tema[campo][Number(marca.dataset.idx)];
    tag[flag] = !tag[flag];
    agendarSalvar();
    renderSheet();
    return;
  }

  // trilhas de pips
  const pip = e.target.closest(".pip");
  if (pip) {
    const path = pip.closest(".trilha").dataset.path;
    const idx = Number(pip.dataset.pipIdx);
    const novoValor = idx + 1;
    if (path === "buildUp") {
      f.buildUp = f.buildUp === novoValor ? idx : novoValor;
    } else if (path === "classificacao") {
      f.classificacao = f.classificacao === novoValor ? idx : novoValor;
    } else if (path.startsWith("tema:")) {
      const [, temaId, campo] = path.split(":");
      const tema = f.temas.find((t) => t.id === temaId);
      tema[campo] = tema[campo] === novoValor ? idx : novoValor;
    } else if (path.startsWith("rastreio:")) {
      const [, ridx, campo] = path.split(":");
      const r = f.rastreios[Number(ridx)];
      r[campo] = r[campo] === novoValor ? idx : novoValor;
    }
    agendarSalvar();
    renderSheet();
    return;
  }

  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const acao = btn.dataset.action;

  if (acao === "nova") {
    const ficha = novaFicha("Novo Personagem");
    estado.dados.chars[ficha.id] = ficha;
    estado.dados.ordem.push(ficha.id);
    (async () => {
      await salvarAgora();
      irPara("sheet", ficha.id, true);
    })();
    return;
  }
  if (acao === "nova-ameaca") {
    const ameaca = novaAmeaca("Nova Ameaça");
    estado.dados.chars[ameaca.id] = ameaca;
    estado.dados.ordem.push(ameaca.id);
    (async () => {
      await salvarAgora();
      irPara("sheet", ameaca.id, true);
    })();
    return;
  }
  if (acao === "aba") {
    estado.abaAtual = btn.dataset.aba;
    renderRoster();
    return;
  }
  if (acao === "ver-moves") {
    irPara("moves");
    return;
  }
  if (acao === "fluxo-mais") {
    f.fluxo = (f.fluxo || 0) + 1;
    agendarSalvar();
    renderSheet();
    return;
  }
  if (acao === "fluxo-menos") {
    f.fluxo = Math.max(0, (f.fluxo || 0) - 1);
    agendarSalvar();
    renderSheet();
    return;
  }
  if (acao === "exportar") {
    exportarFicha(estado.dados.chars[btn.dataset.id]);
    return;
  }
  if (acao === "duplicar") {
    const original = estado.dados.chars[btn.dataset.id];
    if (!original) return;
    const copia = JSON.parse(JSON.stringify(original));
    copia.id = gerarId();
    copia.nome = `${original.nome} (cópia)`;
    copia.tokenId = null;   // uma cópia não herda o vínculo de token do original
    copia.labelItemId = null;
    estado.dados.chars[copia.id] = copia;
    estado.dados.ordem.push(copia.id);
    (async () => {
      await salvarAgora();
      irPara("sheet", copia.id, true);
    })();
    return;
  }
  if (acao === "importar") {
    importarFicha();
    return;
  }
  if (acao === "alternar-edicao") {
    estado.modoEdicao = !estado.modoEdicao;
    renderSheet();
    return;
  }
  if (acao === "abrir") { irPara("sheet", btn.dataset.id); return; }
  if (acao === "voltar") { irPara("roster"); return; }
  if (acao === "excluir") {
    e.stopPropagation();
    const id = btn.dataset.id;
    if (!estado.confirmarExclusao.has(id)) {
      // 1º clique: só arma o botão, ainda não apaga nada
      estado.confirmarExclusao.add(id);
      renderRoster();
      clearTimeout(timersExclusao.get(id));
      timersExclusao.set(id, setTimeout(() => {
        estado.confirmarExclusao.delete(id);
        timersExclusao.delete(id);
        if (estado.view === "roster") renderRoster();
      }, 3000));
      return;
    }
    // 2º clique dentro da janela de tempo: apaga de fato
    clearTimeout(timersExclusao.get(id));
    timersExclusao.delete(id);
    estado.confirmarExclusao.delete(id);
    delete estado.dados.chars[id];
    estado.dados.ordem = estado.dados.ordem.filter((x) => x !== id);
    agendarSalvar();
    renderRoster();
    return;
  }
  if (acao === "trocar-grupo") {
    const tema = f.temas.find((t) => t.id === btn.dataset.temaId);
    tema.grupo = tema.grupo === "cerne" ? "vertente" : "cerne";
    agendarSalvar();
    renderSheet();
    return;
  }
  if (acao === "add-tema") {
    f.temas.push(novoTema(btn.dataset.grupo));
    agendarSalvar();
    renderSheet();
    return;
  }
  if (acao === "remover-tema") {
    if (!confirmarOuArmar(`tema:${btn.dataset.temaId}`)) { renderSheet(); return; }
    f.temas = f.temas.filter((t) => t.id !== btn.dataset.temaId);
    agendarSalvar();
    renderSheet();
    return;
  }
  if (acao === "add-lista") {
    f[btn.dataset.lista].push("");
    agendarSalvar();
    renderSheet();
    return;
  }
  if (acao === "remover-lista") {
    f[btn.dataset.lista].splice(Number(btn.dataset.idx), 1);
    agendarSalvar();
    renderSheet();
    return;
  }
  if (acao === "add-tag") {
    const tema = f.temas.find((t) => t.id === btn.dataset.temaId);
    const ehPoder = btn.dataset.tipo === "poder";
    tema[ehPoder ? "tagsPoder" : "tagsFraqueza"].push({ texto: "", [ehPoder ? "queimada" : "invocada"]: false });
    agendarSalvar();
    renderSheet();
    return;
  }
  if (acao === "remover-tag") {
    const tema = f.temas.find((t) => t.id === btn.dataset.temaId);
    tema[btn.dataset.tipo === "poder" ? "tagsPoder" : "tagsFraqueza"].splice(Number(btn.dataset.idx), 1);
    agendarSalvar();
    renderSheet();
    return;
  }
  if (acao === "add-rastreio") {
    f.rastreios.push(novoRastreio());
    agendarSalvar();
    renderSheet();
    return;
  }
  if (acao === "remover-rastreio") {
    f.rastreios.splice(Number(btn.dataset.idx), 1);
    agendarSalvar();
    renderSheet();
    return;
  }
  if (acao === "add-momento") {
    f.momentos.push({ texto: "", feito: false });
    agendarSalvar();
    renderSheet();
    return;
  }
  if (acao === "remover-momento") {
    f.momentos.splice(Number(btn.dataset.idx), 1);
    agendarSalvar();
    renderSheet();
    return;
  }
  if (acao === "vincular-token") {
    (async () => {
      const tokenId = await tokenSelecionadoAgora();
      if (!tokenId) {
        alert("Selecione um token no mapa primeiro, depois clique em Vincular de novo.");
        return;
      }
      await vincularToken(f.id, tokenId);
      f.tokenId = tokenId;
      await salvarAgora();
      renderSheet();
    })();
    return;
  }
  if (acao === "desvincular-token") {
    (async () => {
      await removerLabel(f);
      await desvincularToken(f.tokenId);
      f.tokenId = null;
      f.labelItemId = null;
      await salvarAgora();
      renderSheet();
    })();
    return;
  }
  if (acao === "add-spectrum") {
    f.spectrums.push(novoSpectrum());
    agendarSalvar();
    renderSheet();
    return;
  }
  if (acao === "remover-spectrum") {
    if (!confirmarOuArmar(`spectrum:${btn.dataset.idx}`)) { renderSheet(); return; }
    f.spectrums.splice(Number(btn.dataset.idx), 1);
    agendarSalvar();
    renderSheet();
    return;
  }
  if (acao === "add-movimento") {
    f.movimentos.push(novoMovimento("duro"));
    agendarSalvar();
    renderSheet();
    return;
  }
  if (acao === "remover-movimento") {
    f.movimentos.splice(Number(btn.dataset.idx), 1);
    agendarSalvar();
    renderSheet();
    return;
  }
});

app.addEventListener("input", (e) => {
  const el = e.target;
  if (el.dataset.buscaRoster !== undefined) {
    estado.filtroTexto = el.value;
    aplicarFiltroRoster();
    return;
  }
  if (el.tagName === "TEXTAREA") ajustarTextarea(el);

  if (estado.view !== "sheet") return;
  const f = fichaAtual();
  if (!f) return;

  if (el.dataset.spectrumIdx !== undefined) {
    const idx = Number(el.dataset.spectrumIdx);
    const campo = el.dataset.field;
    f.spectrums[idx][campo] = campo === "tierMax" ? (Number(el.value) || 1) : el.value;
    agendarSalvar();
    return;
  }
  if (el.dataset.movIdx !== undefined && el.dataset.field === "texto") {
    f.movimentos[Number(el.dataset.movIdx)].texto = el.value;
    agendarSalvar();
    return;
  }
  if (el.dataset.field && el.dataset.temaId) {
    const tema = f.temas.find((t) => t.id === el.dataset.temaId);
    tema[el.dataset.field] = el.value;
    agendarSalvar();
    return;
  }
  if (el.dataset.field && !el.dataset.temaId) {
    if (el.dataset.field === "tamanhoColetivo") {
      f.tamanhoColetivo = el.value === "" ? null : Math.max(1, Math.min(4, Number(el.value) || 1));
    } else {
      f[el.dataset.field] = el.value;
    }
    agendarSalvar();
    return;
  }
  if (el.dataset.momentoTexto !== undefined) {
    f.momentos[Number(el.dataset.momentoIdx)].texto = el.value;
    agendarSalvar();
    return;
  }
  if (el.dataset.lista) {
    f[el.dataset.lista][Number(el.dataset.idx)] = el.value;
    agendarSalvar();
    return;
  }
  if (el.dataset.tagTexto !== undefined) {
    const tema = f.temas.find((t) => t.id === el.dataset.temaId);
    const campo = el.dataset.tipo === "poder" ? "tagsPoder" : "tagsFraqueza";
    tema[campo][Number(el.dataset.idx)].texto = el.value;
    agendarSalvar();
    return;
  }
  if (el.dataset.rastreioField) {
    f.rastreios[Number(el.dataset.idx)][el.dataset.rastreioField] = el.value;
    agendarSalvar();
  }
});

app.addEventListener("change", (e) => {
  const el = e.target;
  if (estado.view !== "sheet") return;
  const f = fichaAtual();
  if (!f) return;

  if (el.dataset.fieldCheck) {
    f[el.dataset.fieldCheck] = el.checked;
    agendarSalvar();
    return;
  }
  if (el.dataset.momentoCheck !== undefined) {
    f.momentos[Number(el.dataset.momentoIdx)].feito = el.checked;
    agendarSalvar();
    renderSheet();
    return;
  }
  if (el.dataset.spectrumIdx !== undefined && el.dataset.field === "contagem") {
    f.spectrums[Number(el.dataset.spectrumIdx)].contagem = el.checked;
    agendarSalvar();
    return;
  }
  if (el.dataset.movIdx !== undefined && el.dataset.field === "tipo") {
    f.movimentos[Number(el.dataset.movIdx)].tipo = el.value;
    agendarSalvar();
    renderSheet(); // atualiza a cor do select conforme o tipo escolhido
  }
});


// ---------- inicialização ----------
OBR.onReady(async () => {
  estado.souGM = (await OBR.player.getRole()) === "GM";
  estado.dados = await carregarFichas();
  estado.presencaAtiva = await presencaInicial();
  render();

  aoMudarFichas((novosDados) => {
    estado.dados = novosDados;
    if (!estado.editando) render();
  });

  aoMudarPresenca((novaPresenca) => {
    estado.presencaAtiva = novaPresenca;
    if (estado.view === "roster") renderRoster();
  });
});

// Melhor esforço: libera minha presença se a extensão for fechada sem
// passar pelo botão Voltar. Não é garantido (a página pode fechar antes da
// mensagem chegar), por isso a expiração automática de 15s continua sendo
// a rede de segurança de verdade.
window.addEventListener("pagehide", () => {
  if (estado.view === "sheet" && estado.atualId) limparPresenca().catch(() => {});
});
