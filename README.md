# Fichas de Sombras — extensão para Owlbear Rodeo

Painel para armazenar e editar em conjunto as fichas de **Sombras de
Victoria** (hack de City of Mist) — fichas de Personagem (Vertente/Cerne)
e fichas de Ameaça (Danger Profile) — com vínculo opcional a tokens do
mapa. Todos os arquivos são estáticos — sem build, sem Node.

## Arquivos

- `manifest.json` — descreve a extensão pro Owlbear (inclui `background_url`)
- `index.html` / `app.js` — o painel principal (roster + fichas)
- `background.html` / `background.js` — página persistente: registra o
  menu de contexto do token e mantém os balões de rastreio sincronizados
  mesmo com o painel fechado
- `revelar.html` / `revelar.js` — popover pequeno aberto no clique-direito
  de um token vinculado, pra revelar/ocultar rastreios
- `schema.js` — modelo de dados (fichas de PC e de Ameaça)
- `storage.js` — leitura/escrita na metadata da sala (fichas + presença)
- `mapa.js` — tudo que fala com a cena (vínculo de token, balão, menu de contexto)
- `style.css` — tema visual (quadro de conspiração / detetive noir)
- `icon.svg` — ícone do botão de ação

## Como hospedar (GitHub Pages, gratuito)

1. Crie um repositório novo no GitHub (pode ser público ou privado com Pages habilitado).
2. Suba estes arquivos na raiz do repositório (ou em uma pasta `docs/`).
3. Em **Settings → Pages**, ative o GitHub Pages apontando pra branch/pasta usada.
4. Anote a URL gerada, algo como:
   `https://SEU_USUARIO.github.io/sombras-fichas/manifest.json`

**Importante:** como o site fica numa subpasta (`usuario.github.io/repo/`),
o `manifest.json` usa URLs absolutas completas em vez de caminhos com `/`
no início — ver a conversa de troubleshooting se for adaptar isso pra outro
domínio.

## Como instalar na sala do Owlbear

1. Abra uma sala no Owlbear Rodeo.
2. Vá em **Room Settings → Extensions → Add Custom Extension**.
3. Cole a URL do `manifest.json` publicado.
4. O ícone da extensão aparece na barra de ações da sala.

## Como funciona

### Armazenamento
- As fichas ficam guardadas na **metadata da sala** do Owlbear, sincronizada
  automaticamente pra todos os jogadores conectados.
- **Limite de 16kB compartilhado** com outras extensões da sala — por isso
  o `storage.js` comprime os dados com lz-string antes de salvar. O painel
  avisa quando o tamanho comprimido está chegando perto do limite.
- Qualquer pessoa pode criar/editar/apagar qualquer ficha (decisão de escopo).
- Fichas abrem em **modo de leitura por padrão**; um botão "Editar" libera
  os campos. Fichas novas/importadas já abrem destravadas.

### Dois tipos de ficha
- **Personagem (`tipo: "pc"`)** — a ficha completa com Vertente/Cerne,
  Build-Up, Moments, etc.
- **Ameaça (`tipo: "danger"`)** — Danger Profile enxuto: Danger Rating,
  Spectrums (tag + tier máximo), Story Tags iniciais, Tracking Cards,
  Movimentos (suave/duro/intrusão/passivo) e Defesas.
- O roster tem duas abas, **mas a aba/lista de Ameaças só aparece pra quem
  está com papel de GM na sala** (`OBR.player.getRole()`). Importante:
  isso é uma permissão de **interface**, não de segurança — a metadata da
  sala continua sendo baixada por todo mundo conectado; um jogador que
  abrisse o DevTools do navegador conseguiria ver o JSON cru. Pra uma mesa
  de confiança normal isso não é um problema.

### Vínculo com token no mapa (vínculo leve, não é o Método 2)
- Dentro de qualquer ficha, "🔗 Vincular token selecionado" pega o token
  que você tiver clicado no mapa (`OBR.player.getSelection()`) e grava uma
  referência nele — a ficha continua morando na metadata da sala, isso é
  só uma referência.
- Sempre que os rastreios (tracking cards) de uma ficha vinculada mudam, o
  `background.js` atualiza sozinho um balão de texto (Label) grudado no
  token, mostrando **só os rastreios marcados como revelados**.
- Pra revelar/ocultar um rastreio específico: **clique-direito no próprio
  token no mapa** → menu de contexto → abre um popover pequeno
  (`revelar.html`) com a lista de rastreios daquela ficha.
- **Limitação conhecida:** o vínculo é por token de uma cena específica.
  Trocar de mapa faz o token (e o balão) não existir mais ali — a extensão
  não trava, só para de atualizar até a ficha ser vinculada a um token
  novo na cena atual.
- **Partes com menos certeza técnica** (testar com calma): o texto exato
  do Label é atualizado via `item.text.plainText` — não há um exemplo
  oficial verbatim disso na documentação, só inferido do padrão dos outros
  builders. Se não atualizar, é o primeiro lugar a olhar.

## Próximos passos possíveis

**Arquitetura**
- **Método 2 de verdade:** mover o conteúdo da ficha pra dentro da
  metadata do próprio token (resolve o limite de 16kB de vez, mas prende
  a ficha a uma cena específica). Ver conversa de design para prós/contras.
- Reposicionar o balão automaticamente quando o token se move pelo mapa
  (hoje ele nasce numa posição fixa relativa ao token, mas não "segue"
  em tempo real).

**Colaboração**
- Indicador de quem está vendo/editando cada ficha agora — já implementado
  (presença via metadata + `OBR.player.getName()`), expirando sozinho
  depois de 15s sem confirmação.

**Ficha em si**
- Trazer o Crew Theme (hoje só as 4 fichas de tema por personagem de PC).
- Interface própria pra Moments of Evolution como checklist.
- Duplicar ficha.
- Revelar rastreio por tag individual dentro dos Power/Weakness Tags
  também (hoje o "revelar" só existe pras Tracking Cards).

**Segurança / qualidade de vida**
- Estender a confirmação em duas camadas (já existe pra excluir ficha)
  pra remoção de tema/spectrum também.
- Busca/filtro no roster.
