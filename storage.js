// storage.js
// Guarda as fichas na metadata da SALA do Owlbear (OBR.room), que é sincronizada
// automaticamente em tempo real para todos os clientes conectados.
//
// IMPORTANTE: a metadata da sala tem um limite de 16kB no TOTAL, compartilhado
// entre TODAS as extensões instaladas na sala — não é um espaço exclusivo nosso.
//
// MÉTODO 1 (atual): comprimimos o JSON com lz-string antes de guardar, e
// descomprimimos ao ler. Isso é um reforço, não uma solução definitiva — se a
// campanha crescer muito, o próximo passo é mover cada ficha pra metadata do
// próprio token do personagem na cena (OBR.scene.items), que não tem esse teto
// compartilhado. Ver README.md, seção "Próximos passos".

import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3.1.0";
import LZString from "https://esm.sh/lz-string@1.5.0";
import { dadosVazios, normalizarDados } from "./schema.js";

const CHAVE = "com.sombrasdevictoria.fichas/dados";
const LIMITE_AVISO_BYTES = 12000; // avisa antes de chegar nos 16kB reais (já contando a compressão)

export async function carregarFichas() {
  const metadata = await OBR.room.getMetadata();
  const bruto = metadata[CHAVE];
  if (!bruto) return dadosVazios();
  try {
    const json = LZString.decompressFromUTF16(bruto);
    if (!json) return dadosVazios(); // string vazia/corrompida — não trava o app
    return normalizarDados(JSON.parse(json));
  } catch (erro) {
    console.error("Falha ao descomprimir fichas, começando vazio:", erro);
    return dadosVazios();
  }
}

export async function salvarFichas(dados) {
  const json = JSON.stringify(dados);
  const comprimido = LZString.compressToUTF16(json);
  await OBR.room.setMetadata({ [CHAVE]: comprimido });
}

export function aoMudarFichas(callback) {
  return OBR.room.onMetadataChange((metadata) => {
    const bruto = metadata[CHAVE];
    if (!bruto) return callback(dadosVazios());
    try {
      const json = LZString.decompressFromUTF16(bruto);
      callback(json ? normalizarDados(JSON.parse(json)) : dadosVazios());
    } catch (erro) {
      console.error("Falha ao descomprimir fichas (mudança remota):", erro);
      callback(dadosVazios());
    }
  });
}

// Mede o tamanho REAL que vai ocupar na metadata (já comprimido), não o JSON cru.
export function checarTamanho(dados) {
  const json = JSON.stringify(dados);
  const comprimido = LZString.compressToUTF16(json);
  const bytes = new Blob([comprimido]).size;
  return { bytes, perto: bytes > LIMITE_AVISO_BYTES, limite: 16000 };
}

// --- Presença: quem está vendo/editando qual ficha agora ---
// Chave separada da dos dados, pequena o bastante pra não precisar comprimir.
// Cada entrada expira sozinha (PRESENCA_EXPIRA_MS) pra não travar "fantasma"
// se alguém fechar o navegador sem passar pelo botão Voltar.
const CHAVE_PRESENCA = "com.sombrasdevictoria.fichas/presenca";
const PRESENCA_EXPIRA_MS = 15000;

function presencaAtivaDe(bruto) {
  const agora = Date.now();
  const ativos = {};
  for (const [fichaId, info] of Object.entries(bruto || {})) {
    if (info && agora - info.ts < PRESENCA_EXPIRA_MS) ativos[fichaId] = info;
  }
  return ativos;
}

async function removerMinhasEntradas(presenca, meuId) {
  const copia = { ...presenca };
  for (const fid of Object.keys(copia)) {
    if (copia[fid]?.id === meuId) delete copia[fid];
  }
  return copia;
}

export async function presencaInicial() {
  const metadata = await OBR.room.getMetadata();
  return presencaAtivaDe(metadata[CHAVE_PRESENCA]);
}

export async function marcarPresenca(fichaId) {
  const meuId = await OBR.player.getId();
  const meuNome = await OBR.player.getName();
  const metadata = await OBR.room.getMetadata();
  let presenca = await removerMinhasEntradas(metadata[CHAVE_PRESENCA] || {}, meuId);
  presenca[fichaId] = { nome: meuNome, id: meuId, ts: Date.now() };
  await OBR.room.setMetadata({ [CHAVE_PRESENCA]: presenca });
}

export async function limparPresenca() {
  const meuId = await OBR.player.getId();
  const metadata = await OBR.room.getMetadata();
  const presenca = await removerMinhasEntradas(metadata[CHAVE_PRESENCA] || {}, meuId);
  await OBR.room.setMetadata({ [CHAVE_PRESENCA]: presenca });
}

export function aoMudarPresenca(callback) {
  return OBR.room.onMetadataChange((metadata) => {
    callback(presencaAtivaDe(metadata[CHAVE_PRESENCA]));
  });
}
