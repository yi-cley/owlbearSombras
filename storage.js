// storage.js
// Guarda as fichas na metadata da SALA do Owlbear (OBR.room), que é sincronizada
// automaticamente em tempo real para todos os clientes conectados.
//
// IMPORTANTE: a metadata da sala tem um limite de 16kB no TOTAL, compartilhado
// entre TODAS as extensões instaladas na sala — não é um espaço exclusivo nosso.
// Por isso o schema é compacto e existe um aviso de tamanho (ver checarTamanho).

import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3.1.0";
import { dadosVazios } from "./schema.js";

const CHAVE = "com.sombrasdevictoria.fichas/dados";
const LIMITE_AVISO_BYTES = 12000; // avisa antes de chegar nos 16kB reais

export async function carregarFichas() {
  const metadata = await OBR.room.getMetadata();
  return metadata[CHAVE] || dadosVazios();
}

export async function salvarFichas(dados) {
  await OBR.room.setMetadata({ [CHAVE]: dados });
}

export function aoMudarFichas(callback) {
  return OBR.room.onMetadataChange((metadata) => {
    callback(metadata[CHAVE] || dadosVazios());
  });
}

export function checarTamanho(dados) {
  const bytes = new Blob([JSON.stringify(dados)]).size;
  return { bytes, perto: bytes > LIMITE_AVISO_BYTES, limite: 16000 };
}
