// moves.js
// Referência rápida dos moves de jogador, em texto ORIGINAL (não é cópia do
// livro) — resumo mecânico condensado, com os termos já adaptados pra
// Sombras de Victoria: Vertente = Mythos (Mistério/Fade), Cerne = Logos
// (Identidade/Crack).

export const MOVES_ACAO = [
  {
    titulo: "Convencer",
    gatilho: "Persuadir, ameaçar ou seduzir alguém a fazer algo — role+Poder.",
    efeito: "Em sucesso, escolha um status relevante (tier = Poder). O alvo escolhe: aceitar o status, ou (7-9) ceder um pouco sem abrir mão da própria agenda, ou (10+) passar a incluir a sua agenda na dele, ao menos por enquanto."
  },
  {
    titulo: "Confronto Direto",
    gatilho: "Disputar controle de algo ou alguém, corpo a corpo ou não — declare seu objetivo, role+Poder.",
    efeito: "Em 7-9, escolha 1; em 10+, escolha 2: alcançar seu objetivo · aplicar um status no oponente (tier=Poder) · bloquear a resposta dele (senão ele te aplica um status de volta)."
  },
  {
    titulo: "Golpe Certeiro",
    gatilho: "Ter uma brecha clara e atacar com tudo — role+Poder.",
    efeito: "Em sucesso, aplica um status à sua escolha (tier=Poder). Em 10+ escolha 2, em 7-9 escolha 1 bônus: se cobrir/ganhar posição · acertar em cheio ou pegar vários (+1 tier) · controlar o estrago colateral · prender a atenção do alvo · ganhar 1 de Fluxo."
  },
  {
    titulo: "Investigar",
    gatilho: "Buscar respostas pra uma questão urgente — role+Poder.",
    efeito: "Em sucesso, ganhe Pistas=Poder; gaste 1 a 1 pra fazer perguntas ao mestre (ou a outro jogador sobre o personagem dele) e receber uma resposta direta ou uma pista sólida. Em 7-9, o mestre escolhe uma complicação: a investigação te expõe a perigo · a pista vem incompleta/parcialmente falsa · quem você questiona pode te perguntar de volta, nos mesmos termos."
  },
  {
    titulo: "Agir na Sombra",
    gatilho: "Agir de forma secreta ou enganosa — role+Poder.",
    efeito: "Em sucesso, funciona. Em 7-9, o mestre escolhe uma complicação: alguém sem importância percebeu (e agora passou a importar) · você só é percebido por um sentido indireto · você precisa deixar algo importante pra trás, ou ser descoberto."
  },
  {
    titulo: "Arriscar Tudo",
    gatilho: "Tentar uma proeza ousada, arriscada ou francamente idiota — role+Poder.",
    efeito: "Em 10+, dá certo de algum jeito. Em 7-9, complica — o mestre oferece uma barganha dura ou uma escolha feia."
  },
  {
    titulo: "Virar o Jogo",
    gatilho: "Dar vantagem a si mesmo ou a um aliado — role+Poder.",
    efeito: "Em sucesso, ganhe Fluxo=Poder; gaste 1 a 1 em: criar uma story tag · queimar uma power tag ou story tag · dar/reduzir um status (1 tier por ponto). Em 10+, mínimo de 2 de Fluxo, com opções extras: ampliar o efeito, prolongar, esconder, ou combinar algo novo com o mestre."
  },
  {
    titulo: "Encarar o Perigo",
    gatilho: "Resistir a um golpe, aguentar um dano, uma influência maligna ou se segurar sob pressão — role+Poder.",
    efeito: "Em 10+, você não leva status nenhum. Em 7-9, leva o status com -1 tier. Em fracasso, leva o status completo."
  }
];

export const MOVES_SESSAO = [
  {
    titulo: "Entreato (Downtime)",
    gatilho: "Sempre que seu personagem tiver um tempo livre, escolha uma atividade:",
    efeito: "dedicar atenção a um tema de Cerne (marca Attention) · investigar o caso (ganha 3 Pistas) · explorar um Mistério de Vertente (ganha 1 Pista, marca Attention) · se preparar (recupera tags queimadas OU ganha Fluxo) · se recuperar (reduz um status ativo, com o mestre decidindo quanto)."
  },
  {
    titulo: "Flashback",
    gatilho: "Uma vez por sessão, com a cena em foco, escolha:",
    efeito: "narrar uma ação do passado do personagem e rolar por ela (o resultado afeta a cena atual), ou revelar algo do histórico do personagem em troca de Fluxo ou Pista, a critério do mestre."
  },
  {
    titulo: "Fim de Sessão",
    gatilho: "Ao encerrar a sessão, cada jogador responde uma ou mais perguntas:",
    efeito: "como a Crew cresceu (recupera uma power tag da crew ou marca Attention num tema de crew) · quem teve a interação mais marcante com seu personagem (ganha ponto de Ajuda ou Ferimento) · qual tema está sob mais pressão (escreve uma nova Flipside)."
  }
];

export const MOVES_VERTENTE = [
  {
    titulo: "Finalmente, Respostas",
    gatilho: "Quando seu Mistério é respondido, escolha uma, duas, ou as três:",
    efeito: "aprofundar o entendimento sobre a Vertente (marca Attention) · se abalar com a descoberta (marca Fade ou Crack em qualquer tema) · encerrar essa dúvida e escolher um novo Mistério pro tema."
  },
  {
    titulo: "Sem Limites",
    gatilho: "Usar seus poderes de um jeito nunca visto ou em escala inédita — role+Cerne (sim, com Cerne, não Vertente — é a força de vontade mundana que sustenta o esforço sobrenatural).",
    efeito: "O mestre avisa o preço antes da rolagem. Em sucesso, você consegue o que queria e paga o preço combinado (marcar Fade/Crack, queimar tags, trocar um tema, ou em casos extremos um status tier-6). Em fracasso, paga o preço e ainda perde o controle do efeito."
  }
];

export const MOVES_CERNE = [
  {
    titulo: "Fim de Estrada",
    gatilho: "Quando sua Identidade se resolve de vez,",
    efeito: "reformule-a com um objetivo novo e mais amplo, ou, se aquele capítulo realmente acabou, troque o tema inteiro."
  },
  {
    titulo: "Escolha Difícil",
    gatilho: "Quando seus valores de Cerne entram em conflito com a situação:",
    efeito: "abrir mão de uma resposta ao seu Mistério que estava ao alcance marca Fade · não agir/falar como sua Identidade exige marca Crack · sacrificar algo que você queria pra manter sua Identidade marca Attention."
  }
];
