import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3.1.0";
import { novaFicha, novoTema, novoRastreio } from "./schema.js";
import { carregarFichas, salvarFichas, aoMudarFichas, checarTamanho } from "./storage.js";

const ROSTER_W = 340, ROSTER_H = 480;
const SHEET_W = 900, SHEET_H = 680;

const app = document.getElementById("app");

const estado = {
  view: "roster",       // "roster" | "sheet"
  dados: { chars: {}, ordem: [] },
  atualId: null,
  editando: false,       // true enquanto um input está com foco (evita sobrescrever digitação)
};

let salvarTimer = null;
function agendarSalvar() {
  clearTimeout(salvarTimer);
  salvarTimer = setTimeout(() => salvarFichas(estado.dados), 400);
}

// ---------- utilidades de caminho ----------
function getPath(obj, path) {
  return path.split(".").reduce((cur, p) => (cur == null ? undefined : cur[/^\d+$/.test(p) ? Number(p) : p]), obj);
}
function setPath(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    cur = cur[/^\d+$/.test(p) ? Number(p) : p];
  }
  const last = parts[parts.length - 1];
  cur[/^\d+$/.test(last) ? Number(last) : last] = value;
}

function esc(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- render: aviso de tamanho ----------
function avisoTamanhoHtml() {
  const { perto, bytes, limite } = checarTamanho(estado.dados);
  if (!perto) return "";
  return `<div class="aviso">A metadata da sala está em ${bytes} de ${limite} bytes (limite compartilhado com outras extensões). Considere encurtar descrições ou remover fichas não usadas.</div>`;
}

// ---------- render: roster ----------
function renderRoster() {
  const ids = estado.dados.ordem;
  const itens = ids.length
    ? ids.map((id) => {
        const f = estado.dados.chars[id];
        if (!f) return "";
        const cerneT = f.temas.filter((t) => t.grupo === "cerne").map((t) => t.titulo).filter(Boolean).join(" · ");
        return `
          <div class="roster-item" data-action="abrir" data-id="${id}">
            <div>
              <div class="nome">${esc(f.nome)}</div>
              <div class="sub">${esc(f.jogador || "sem jogador")}${cerneT ? " — " + esc(cerneT) : ""}</div>
            </div>
            <button data-action="excluir" data-id="${id}" class="perigo">✕</button>
          </div>`;
      }).join("")
    : `<div class="vazio">Nenhuma ficha ainda. Crie a primeira abaixo.</div>`;

  app.innerHTML = `
    ${avisoTamanhoHtml()}
    <div class="roster-header">
      <h2>Fichas de Sombras</h2>
    </div>
    <div>${itens}</div>
    <div class="linha-botoes">
      <button data-action="nova" class="primario">+ Nova Ficha</button>
    </div>
  `;
}

// ---------- render: trilha de pips ----------
function renderTrilha(valor, max, path, cor) {
  let html = `<div class="trilha" data-path="${path}" data-max="${max}">`;
  for (let i = 0; i < max; i++) {
    html += `<span class="pip ${i < valor ? "cheio " + cor : ""}" data-pip-idx="${i}"></span>`;
  }
  html += `</div>`;
  return html;
}

// ---------- render: tags (poder/fraqueza) ----------
function renderTags(temaId, lista, tipo, campoFlag, rotuloFlag) {
  const linhas = (lista || []).map((tag, idx) => `
    <div class="tag-item">
      <input type="checkbox" data-tag-toggle data-tema-id="${temaId}" data-tipo="${tipo}" data-idx="${idx}" ${tag[campoFlag] ? "checked" : ""} title="${rotuloFlag}" />
      <input type="text" value="${esc(tag.texto)}" placeholder="Texto da tag" data-tag-texto data-tema-id="${temaId}" data-tipo="${tipo}" data-idx="${idx}" />
      <button data-action="remover-tag" data-tema-id="${temaId}" data-tipo="${tipo}" data-idx="${idx}">✕</button>
    </div>`).join("");
  return `<div class="lista-tags">${linhas}</div>
    <button data-action="add-tag" data-tema-id="${temaId}" data-tipo="${tipo}" style="margin-top:4px;">+ tag</button>`;
}

// ---------- render: um tema (Cerne ou Vertente) ----------
function renderTema(t) {
  const grupo = t.grupo; // "cerne" | "vertente"
  const rotulo = grupo === "cerne" ? "Cerne" : "Vertente";
  const perguntaLabel = grupo === "cerne" ? "Mistério" : "Identidade";
  const trilha2Label = grupo === "cerne" ? "Fade" : "Crack";
  return `
    <div class="tema-card ${grupo}" data-tema-id="${t.id}">
      <div class="rotulo">${rotulo}</div>
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
          ${renderTrilha(t.atencao, 4, `tema:${t.id}:atencao`, grupo)}
        </div>
        <div class="campo">
          <label>${trilha2Label}</label>
          ${renderTrilha(t.fadeCrack, 4, `tema:${t.id}:fadeCrack`, "danger")}
        </div>
      </div>
      <div class="campo">
        <label>${perguntaLabel}</label>
        <input type="text" value="${esc(t.pergunta)}" data-field="pergunta" data-tema-id="${t.id}" />
      </div>
      <div class="campo">
        <label>Descrição</label>
        <textarea data-field="descricao" data-tema-id="${t.id}">${esc(t.descricao)}</textarea>
      </div>
      <div class="campo">
        <label>Power Tags</label>
        ${renderTags(t.id, t.tagsPoder, "poder", "queimada", "Queimada")}
      </div>
      <div class="campo">
        <label>Weakness Tags</label>
        ${renderTags(t.id, t.tagsFraqueza, "fraqueza", "invocada", "Invocada")}
      </div>
      <div class="campo">
        <label>Flipside</label>
        <textarea data-field="flipside" data-tema-id="${t.id}">${esc(t.flipside)}</textarea>
      </div>
    </div>`;
}

// ---------- render: rastreios (status tags) ----------
function renderRastreios(f) {
  const linhas = (f.rastreios || []).map((r, idx) => `
    <div class="rastreio-item">
      <input type="text" value="${esc(r.tag)}" placeholder="Nome do status" data-rastreio-field="tag" data-idx="${idx}" style="max-width:180px;" />
      ${renderTrilha(r.tier, 6, `rastreio:${idx}:tier`, "danger")}
      <button data-action="remover-rastreio" data-idx="${idx}" class="perigo">✕</button>
    </div>`).join("");
  return `${linhas}<button data-action="add-rastreio">+ Status</button>`;
}

// ---------- render: sheet completo ----------
function renderSheet() {
  const f = estado.dados.chars[estado.atualId];
  if (!f) { estado.view = "roster"; return renderRoster(); }
  const cerneTemas = f.temas.filter((t) => t.grupo === "cerne");
  const vertenteTemas = f.temas.filter((t) => t.grupo === "vertente");

  app.innerHTML = `
    ${avisoTamanhoHtml()}
    <button class="voltar" data-action="voltar">← Voltar</button>
    <div class="sheet-header">
      <div class="linha">
        <div class="campo"><label>Nome</label><input type="text" value="${esc(f.nome)}" data-field="nome" /></div>
        <div class="campo"><label>Jogador</label><input type="text" value="${esc(f.jogador)}" data-field="jogador" /></div>
      </div>
      <div class="linha">
        <div class="campo"><label>Crew</label><input type="text" value="${esc(f.crew)}" data-field="crew" /></div>
        <div class="campo"><label>Story Tags</label><input type="text" value="${esc(f.storyTags)}" data-field="storyTags" /></div>
      </div>
      <div class="campo">
        <label>Build-Up</label>
        ${renderTrilha(f.buildUp, 4, "buildUp", "")}
      </div>
      <div class="campo"><label>Nemesis</label><input type="text" value="${esc(f.nemesis)}" data-field="nemesis" /></div>
    </div>

    <div class="duas-colunas">
      <div class="coluna-cerne">${cerneTemas.map(renderTema).join("")}</div>
      <div class="divisoria"></div>
      <div class="coluna-vertente">${vertenteTemas.map(renderTema).join("")}</div>
    </div>

    <div class="secao-titulo"><h3>Tracking Cards</h3></div>
    ${renderRastreios(f)}
  `;
}

function render() {
  if (estado.view === "roster") renderRoster();
  else renderSheet();
}

// ---------- redimensionar o popover ----------
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
  const btn = e.target.closest("[data-action]");
  const pip = e.target.closest(".pip");
  const f = estado.dados.chars[estado.atualId];

  if (pip) {
    const trilhaEl = pip.closest(".trilha");
    const path = trilhaEl.dataset.path;
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
  if (acao === "add-tag") {
    const tema = f.temas.find((t) => t.id === btn.dataset.temaId);
    const campo = btn.dataset.tipo === "poder" ? "tagsPoder" : "tagsFraqueza";
    const flag = btn.dataset.tipo === "poder" ? "queimada" : "invocada";
    tema[campo].push({ texto: "", [flag]: false });
    agendarSalvar();
    renderSheet();
    return;
  }
  if (acao === "remover-tag") {
    const tema = f.temas.find((t) => t.id === btn.dataset.temaId);
    const campo = btn.dataset.tipo === "poder" ? "tagsPoder" : "tagsFraqueza";
    tema[campo].splice(Number(btn.dataset.idx), 1);
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
  const f = estado.dados.chars[estado.atualId];
  const el = e.target;

  if (el.dataset.field && !el.dataset.temaId) {
    // campo de nível de personagem (nome, jogador, crew, storyTags, nemesis)
    if (estado.view === "roster") return;
    setPath(f, el.dataset.field, el.value);
    agendarSalvar();
    if (el.dataset.field === "nome") return; // não precisa re-renderizar tudo
    return;
  }
  if (el.dataset.field && el.dataset.temaId) {
    const tema = f.temas.find((t) => t.id === el.dataset.temaId);
    tema[el.dataset.field] = el.value;
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
    return;
  }
});

app.addEventListener("change", (e) => {
  const f = estado.dados.chars[estado.atualId];
  const el = e.target;
  if (el.dataset.tagToggle !== undefined) {
    const tema = f.temas.find((t) => t.id === el.dataset.temaId);
    const campo = el.dataset.tipo === "poder" ? "tagsPoder" : "tagsFraqueza";
    const flag = el.dataset.tipo === "poder" ? "queimada" : "invocada";
    tema[campo][Number(el.dataset.idx)][flag] = el.checked;
    agendarSalvar();
  }
});

// ---------- inicialização ----------
OBR.onReady(async () => {
  estado.dados = await carregarFichas();
  render();

  aoMudarFichas((novosDados) => {
    estado.dados = novosDados;
    // Evita sobrescrever o que a pessoa está digitando agora mesmo.
    if (!estado.editando) render();
  });
});
