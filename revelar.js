// revelar.js
// Mini-app à parte, aberta como popover no clique-direito de um token
// vinculado (ver mapa.js). Lista os rastreios da ficha vinculada e deixa
// alternar revelado/oculto — o que decide se aparece no balão do token.

import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3.1.0";
import { carregarFichas, salvarFichas } from "./storage.js";

const params = new URLSearchParams(location.search);
const fichaId = params.get("fichaId");
const app = document.getElementById("app");

function esc(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

let dados = null;
let ficha = null;

function render() {
  if (!fichaId || !ficha) {
    app.innerHTML = `<div class="vazio">Este token não está vinculado a nenhuma ficha de Sombras.</div>`;
    return;
  }
  const linhas = (ficha.rastreios || []).length
    ? ficha.rastreios.map((r, idx) => `
        <div class="rastreio-item">
          <div style="flex:1;">
            <div class="nome" style="font-size:12px;">${esc(r.tag) || "(sem nome)"}</div>
            <div class="sub">tier ${r.tier}</div>
          </div>
          <button data-idx="${idx}" class="${r.revelado ? "primario" : ""}">${r.revelado ? "👁 Revelado" : "Oculto"}</button>
        </div>`).join("")
    : `<div class="vazio">Essa ficha ainda não tem rastreios.</div>`;

  app.innerHTML = `
    <h3 style="margin-bottom:8px;">${esc(ficha.nome)}</h3>
    ${linhas}
  `;
}

app.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-idx]");
  if (!btn || !ficha) return;
  const idx = Number(btn.dataset.idx);
  ficha.rastreios[idx].revelado = !ficha.rastreios[idx].revelado;
  await salvarFichas(dados);
  render();
});

OBR.onReady(async () => {
  dados = await carregarFichas();
  ficha = fichaId ? dados.chars[fichaId] || null : null;
  render();
});
