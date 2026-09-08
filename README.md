# Fichas de Sombras — extensão para Owlbear Rodeo

Painel para armazenar e editar em conjunto as fichas de personagem de
**Sombras de Victoria** (hack de City of Mist), com Cerne e Vertente
lado a lado. Todos os arquivos são estáticos — sem build, sem Node.

## Arquivos

- `manifest.json` — descreve a extensão pro Owlbear
- `index.html` / `style.css` / `app.js` / `schema.js` / `storage.js` — o app
- `icon.svg` — ícone do botão de ação

## Como hospedar (GitHub Pages, gratuito)

1. Crie um repositório novo no GitHub (pode ser público ou privado com Pages habilitado).
2. Suba estes arquivos na raiz do repositório (ou em uma pasta `docs/`).
3. Em **Settings → Pages**, ative o GitHub Pages apontando pra branch/pasta usada.
4. Anote a URL gerada, algo como:
   `https://SEU_USUARIO.github.io/sombras-fichas/manifest.json`

## Como instalar na sala do Owlbear

1. Abra uma sala no Owlbear Rodeo.
2. Vá em **Room Settings → Extensions → Add Custom Extension** (ou o menu
   equivalente na sua versão).
3. Cole a URL do `manifest.json` publicado.
4. O ícone da extensão aparece na barra de ações da sala — clique para
   abrir a lista de fichas.

## Como funciona

- As fichas ficam guardadas na **metadata da sala** do Owlbear, que é
  sincronizada automaticamente para todos os jogadores conectados. Não
  existe backend próprio — tudo passa pelo próprio Owlbear.
- Qualquer pessoa com a extensão aberta pode criar, editar e apagar
  qualquer ficha (como combinado).
- **Limite importante:** a metadata da sala tem um teto de 16kB no
  total, compartilhado com todas as outras extensões instaladas na
  mesma sala. Fichas completas de City of Mist ultrapassam esse
  limite rápido (6 fichas bem detalhadas passam de 22kB em JSON
  cru) — por isso o `storage.js` **comprime os dados com lz-string**
  antes de salvar e descomprime ao ler. O painel mostra um aviso
  quando o tamanho comprimido está chegando perto do limite real.

## Próximos passos possíveis

- **Método 2 (planejado):** migrar cada ficha da metadata da sala
  pra metadata do próprio token do personagem na cena
  (`OBR.scene.items`), que não tem esse teto compartilhado. Resolve
  o limite de vez, mas troca a API de sincronização inteira e exige
  que cada personagem já tenha um token na cena — ver a conversa de
  design que motivou essa extensão para os prós/contras completos.
- Botão de exportar/importar ficha em JSON (backup manual)
- Diferenciar visualmente quem é o "dono" de cada ficha
- Um modo compacto de leitura pra jogadores, com o editor liberado só
  pra quem clicar em "editar"
- Trazer o Crew Theme (hoje só as 4 fichas de tema por personagem)
