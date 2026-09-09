// background.js
// Roda o tempo todo enquanto a extensão está ativa na sala (ver
// "background_url" no manifest.json) — independente do painel estar aberto
// ou fechado. Duas responsabilidades:
//   1. Registrar o item de menu de contexto (clique-direito no token).
//   2. Manter o balão de rastreios revelados em dia em qualquer token
//      vinculado, sempre que os dados de qualquer ficha mudarem.

import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3.1.0";
import { carregarFichas, salvarFichas, aoMudarFichas } from "./storage.js";
import { configurarMenuContexto, abrirPopoverRevelar, sincronizarLabel } from "./mapa.js";

async function sincronizarTodosOsLabels(dados) {
  let mudouAlgumaCoisa = false;
  for (const ficha of Object.values(dados.chars)) {
    if (!ficha.tokenId) continue;
    const resultado = await sincronizarLabel(ficha);
    if (resultado?.mudou) {
      ficha.labelItemId = resultado.labelItemId;
      mudouAlgumaCoisa = true;
    }
  }
  if (mudouAlgumaCoisa) {
    await salvarFichas(dados).catch(() => {});
  }
}

OBR.onReady(async () => {
  configurarMenuContexto((fichaId, elementId) => abrirPopoverRevelar(fichaId, elementId));

  // sincroniza uma vez ao carregar (cobre o caso de reabrir uma cena) e depois
  // sempre que a metadata das fichas mudar
  const dadosIniciais = await carregarFichas();
  await sincronizarTodosOsLabels(dadosIniciais);

  aoMudarFichas((novosDados) => {
    sincronizarTodosOsLabels(novosDados);
  });
});
