// mapa.js
// Tudo que fala com a CENA do Owlbear (não com a metadata da sala): vínculo
// de ficha com token, o balão de texto (Label) grudado no token mostrando os
// rastreios revelados, e o item de menu de contexto pra revelar/ocultar cada
// rastreio direto no clique-direito do token.
//
// Isso é um vínculo LEVE (ver conversa de design) — a ficha continua morando
// na metadata da sala como sempre; só ganha uma referência de token. Não é o
// Método 2.

import OBR, { buildLabel } from "https://esm.sh/@owlbear-rodeo/sdk@3.1.0";

const ID = "com.sombrasdevictoria.fichas";
const CHAVE_TOKEN_FICHA = `${ID}/fichaId`;
const ID_MENU = `${ID}/context-menu`;

// ---------- seleção e vínculo ----------

export async function tokenSelecionadoAgora() {
  const selecao = await OBR.player.getSelection();
  if (!selecao || selecao.length === 0) return null;
  return selecao[0];
}

export async function nomeDoToken(tokenId) {
  if (!tokenId) return null;
  try {
    const itens = await OBR.scene.items.getItems([tokenId]);
    return itens[0]?.name || null;
  } catch {
    return null;
  }
}

export async function vincularToken(fichaId, tokenId) {
  await OBR.scene.items.updateItems([tokenId], (itens) => {
    for (const item of itens) item.metadata[CHAVE_TOKEN_FICHA] = fichaId;
  });
}

export async function desvincularToken(tokenId) {
  if (!tokenId) return;
  try {
    await OBR.scene.items.updateItems([tokenId], (itens) => {
      for (const item of itens) delete item.metadata[CHAVE_TOKEN_FICHA];
    });
  } catch {
    // token pode já não existir mais nesta cena (trocou de mapa) — sem problema
  }
}

// ---------- balão de rastreios (+ Fluxo, pra PC) no token ----------

function textoDoLabel(ficha) {
  const linhas = [];
  if (ficha.tipo === "pc" && ficha.mostrarFluxo) {
    linhas.push(`Fluxo [${ficha.fluxo || 0}]`);
  }
  const revelados = (ficha.rastreios || []).filter((r) => r.revelado && r.tier > 0);
  for (const r of revelados) {
    linhas.push(`${r.tag || "status"} [${r.tier}]`);
  }
  return linhas.join("\n");
}

// Cria/atualiza/remove o balão conforme o estado atual dos rastreios revelados.
// Retorna { mudou, labelItemId } — quem chamar deve salvar labelItemId na
// ficha quando mudou === true.
export async function sincronizarLabel(ficha) {
  if (!ficha?.tokenId) return { mudou: false };

  try {
    const tokens = await OBR.scene.items.getItems([ficha.tokenId]);
    const token = tokens[0];
    if (!token) return { mudou: false }; // token não existe nesta cena agora

    const texto = textoDoLabel(ficha);

    if (!texto) {
      if (ficha.labelItemId) {
        await OBR.scene.items.deleteItems([ficha.labelItemId]).catch(() => {});
        return { mudou: true, labelItemId: null };
      }
      return { mudou: false };
    }

    if (ficha.labelItemId) {
      const existentes = await OBR.scene.items.getItems([ficha.labelItemId]);
      if (existentes[0]) {
        await OBR.scene.items.updateItems([ficha.labelItemId], (itens) => {
          for (const item of itens) {
            item.text.plainText = texto;
            item.position = { x: token.position.x + 90, y: token.position.y };
          }
        });
        return { mudou: false };
      }
    }

    const item = buildLabel()
      .plainText(texto)
      .position({ x: token.position.x + 90, y: token.position.y })
      .attachedTo(token.id)
      .layer("ATTACHMENT")
      .disableHit(true)
      .build();
    await OBR.scene.items.addItems([item]);
    return { mudou: true, labelItemId: item.id };
  } catch (erro) {
    console.error("Falha ao sincronizar balão do token:", erro);
    return { mudou: false };
  }
}

export async function removerLabel(ficha) {
  if (ficha?.labelItemId) {
    try { await OBR.scene.items.deleteItems([ficha.labelItemId]); } catch {}
  }
}

// ---------- menu de contexto (clique-direito no token) ----------

export function configurarMenuContexto(aoClicar) {
  OBR.contextMenu.create({
    id: ID_MENU,
    icons: [
      {
        icon: new URL("icon.svg", document.baseURI).href,
        label: "Rastreios de Sombras",
        filter: { every: [{ key: "layer", value: "CHARACTER" }] }
      }
    ],
    onClick(context, elementId) {
      const item = context.items[0];
      const fichaId = item?.metadata?.[CHAVE_TOKEN_FICHA];
      aoClicar(fichaId, elementId);
    }
  });
}

export function abrirPopoverRevelar(fichaId, elementId) {
  const url = new URL(
    `revelar.html?fichaId=${encodeURIComponent(fichaId || "")}`,
    document.baseURI
  ).href;
  OBR.popover.open({
    id: `${ID}/popover-revelar`,
    url,
    width: 260,
    height: 320,
    anchorElementId: elementId
  });
}
