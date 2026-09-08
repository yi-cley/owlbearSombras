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
  mesma sala. Isso costuma ser suficiente pra um grupo de jogo comum
  (4-6 fichas completas), mas o painel mostra um aviso quando o uso
  está chegando perto do limite. Se isso acontecer com frequência,
  dá pra migrar o armazenamento pra um serviço externo simples
  (ex: um Cloudflare Worker ou Firebase) — é só trocar o conteúdo de
  `storage.js`, o resto do app não muda.
## Próximos passos possíveis
 
- Botão de exportar/importar ficha em JSON (backup manual)
- Diferenciar visualmente quem é o "dono" de cada ficha
- Um modo compacto de leitura pra jogadores, com o editor liberado só
  pra quem clicar em "editar"
- Trazer o Crew Theme (hoje só as 4 fichas de tema por personagem)
