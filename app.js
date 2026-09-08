import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3.1.0";
import { novaFicha, novoTema, novoRastreio } from "./schema.js";
import { carregarFichas, salvarFichas, aoMudarFichas, checarTamanho } from "./storage.js";

const ROSTER_W = 340, ROSTER_H = 480;
const SHEET_W = 900, SHEET_H = 680;

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
};

let salvarTimer = null;
function agendarSalvar() {
  clearTimeout(salvarTimer);
  salvarTimer = setTimeout(() => salvarFichas(estado.dados), 400);
}

function esc(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function fichaAtual() {
  return estado.dados.chars[estado.atualId];
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

// ---------- roster ----------
function renderRoster() {
  const ids = estado.dados.ordem;
  const itens = ids.length
    ? ids.map((id) => {
        const f = estado.dados.chars[id];
        if (!f) return "";
        const temasNomes = f.temas.map((t) => t.titulo).filter(Boolean).join(" · ");
        return `
          <div class="roster-item" data-action="abrir" data-id="${id}">
            <div>
              <div class="nome">${esc(f.nome)}</div>
              <div class="sub">${esc(f.jogador || "sem jogador")}${temasNomes ? " — " + esc(temasNomes) : ""}</div>
            </div>
            <button data-action="excluir" data-id="${id}" class="perigo">✕</button>
          </div>`;
      }).join("")
    : `<div class="vazio">Nenhuma ficha ainda. Crie a primeira abaixo.</div>`;

  app.innerHTML = `
    ${avisoTamanhoHtml()}
    <div class="roster-header"><h2>Fichas de Sombras</h2></div>
    <div>${itens}</div>
    <div class="linha-botoes"><button data-action="nova" class="primario">+ Nova Ficha</button></div>
  `;
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
  return `
    <div class="tema-card ${t.grupo}" data-tema-id="${t.id}">
      <div class="tema-topo">
        <span class="rotulo">${cfg.rotulo}</span>
        <div class="tema-acoes">
          <button data-action="trocar-grupo" data-tema-id="${t.id}" title="Converter para ${outro}">⇄ ${outro}</button>
          <button data-action="remover-tema" data-tema-id="${t.id}" class="perigo" title="Remover tema">✕</button>
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

// ---------- ficha completa ----------
function renderSheet() {
  const f = fichaAtual();
  if (!f) { estado.view = "roster"; return renderRoster(); }

  const vertentes = f.temas.filter((t) => t.grupo === "vertente");
  const cernes = f.temas.filter((t) => t.grupo === "cerne");

  app.innerHTML = `
    ${avisoTamanhoHtml()}
    <button class="voltar" data-action="voltar">← Voltar</button>
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
        <div class="campo"><label>Nemesis</label><input type="text" value="${esc(f.nemesis)}" data-field="nemesis" /></div>
      </div>
    </div>

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
  `;
  ajustarTodasTextareas();
}

function render() {
  if (estado.view === "roster") renderRoster();
  else renderSheet();
}

async function irPara(view, id) {
  estado.view = view;
  estado.atualId = id || null;
  if (view === "sheet") {
    await OBR.action.setWidth(SHEET_W);
    await OBR.action.setHeight(SHEET_H);
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
    agendarSalvar();
    irPara("sheet", ficha.id);
    return;
  }
  if (acao === "abrir") { irPara("sheet", btn.dataset.id); return; }
  if (acao === "voltar") { irPara("roster"); return; }
  if (acao === "excluir") {
    e.stopPropagation();
    if (!confirm("Excluir esta ficha para todos na sala?")) return;
    delete estado.dados.chars[btn.dataset.id];
    estado.dados.ordem = estado.dados.ordem.filter((id) => id !== btn.dataset.id);
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
    if (!confirm("Remover este tema?")) return;
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
});

app.addEventListener("input", (e) => {
  const el = e.target;
  if (el.tagName === "TEXTAREA") ajustarTextarea(el);

  if (estado.view !== "sheet") return;
  const f = fichaAtual();
  if (!f) return;

  if (el.dataset.field && !el.dataset.temaId) {
    f[el.dataset.field] = el.value;
    agendarSalvar();
    return;
  }
  if (el.dataset.field && el.dataset.temaId) {
    const tema = f.temas.find((t) => t.id === el.dataset.temaId);
    tema[el.dataset.field] = el.value;
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

// ---------- inicialização ----------
OBR.onReady(async () => {
  estado.dados = await carregarFichas();
  render();
  aoMudarFichas((novosDados) => {
    estado.dados = novosDados;
    if (!estado.editando) render();
  });
});
