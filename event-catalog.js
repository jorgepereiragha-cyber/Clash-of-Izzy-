const EVENT_CATALOG = [
  {
    key: "angel_of_death",
    name: "Anjo da Morte",
    epithet: "O Ceifador do Fim",
    image: "/assets/art/events/angel-of-death.svg",
    imageAlt: "Ceifador alado diante de uma lua rubra",
    description: "Chefe mundial de fim de semana. O dano, as baixas e a classificação são calculados pelo Worker.",
    rewardMode: "actual",
    rewardText: "Prêmios reais por colocação: até 12.000 gemas e 500 Essências da Morte para o 1º lugar; participação concede 100 gemas e 30 essências.",
    href: "#angel-event",
    action: "Abrir batalha"
  },
  {
    key: "valhalla",
    name: "Ascensão de Valhalla",
    epithet: "Temporada das Runas",
    image: "/assets/art/events/valhalla.svg",
    imageAlt: "Coroa rúnica dourada diante de montanhas e aurora",
    description: "Modo sazonal com Runas do Destino, catálogo próprio, tropas e heróis de temporada. A ativação depende da configuração Master no servidor.",
    rewardMode: "conditional",
    rewardText: "Quando habilitado, a configuração atual prevê Runas diárias e acesso ao catálogo sazonal; o valor vem do servidor.",
    href: "/kingdom.html",
    action: "Abrir reino"
  },
  {
    key: "wild_hunt",
    name: "Caçada Selvagem",
    epithet: "Rastros de Fenrir",
    image: "/assets/art/events/wild-hunt.svg",
    imageAlt: "Lobo colossal com chifres entre pinheiros nevados",
    description: "Caçada cooperativa planejada para o mapa compartilhado. O banco já possui tabelas de caçada, mas o controlador de combate e a distribuição ainda não estão conectados.",
    rewardMode: "preview",
    rewardText: "Prévia: runas por contribuição, baú de participação e bônus por chefe derrotado. Não há saque ativo nesta edição."
  },
  {
    key: "shiva",
    name: "Shiva",
    epithet: "O Despertar Cósmico",
    image: "/assets/art/events/shiva.svg",
    imageAlt: "Figura divina estilizada em meditação diante de um tridente e halo cósmico",
    description: "Chefe mundial de tema cósmico, com arte original respeitosa inspirada em símbolos de criação e transformação.",
    rewardMode: "preview",
    rewardText: "Prévia: fragmentos do Trishula, Essência Cósmica, recursos do reino e título Guardião da Aurora. Recompensas ainda não são creditadas."
  },
  {
    key: "khali",
    name: "Khali",
    epithet: "A Rainha do Véu",
    image: "/assets/art/events/khali.svg",
    imageAlt: "Rainha guerreira mística em um templo de lótus e luar",
    description: "Desafio lendário de progressão, com identidade visual própria e encontro dedicado em preparação.",
    rewardMode: "preview",
    rewardText: "Prévia: Fragmentos do Véu, baús de ouro, cosmético exclusivo e título Rainha do Crepúsculo. Recompensas ainda não são creditadas."
  },
  {
    key: "siege_of_eldoria",
    name: "Cerco de Eldoria",
    epithet: "Alianças em Guerra",
    image: "/assets/art/events/siege-of-eldoria.svg",
    imageAlt: "Castelo medieval fortificado sob cerco com estandartes azuis e dourados",
    description: "Evento de objetivos entre alianças. A base de alianças e guerras existe; calendário sazonal, pontuação e premiação do evento precisam de integração.",
    rewardMode: "preview",
    rewardText: "Prévia: Medalhas de Aliança, caixas de recursos, estandarte e título Marechal de Eldoria. Ainda não há distribuição de evento."
  },
  {
    key: "champions_tournament",
    name: "Torneio dos Campeões",
    epithet: "Provação dos Heróis",
    image: "/assets/art/events/champions-tournament.svg",
    imageAlt: "Duas espadas cruzadas diante de um louro dourado",
    description: "Competição de habilidade inspirada na Arena existente. Chaveamento, temporada, antitrapaça e pagamento de prêmios ainda precisam ser integrados.",
    rewardMode: "preview",
    rewardText: "Prévia: Insígnias de Campeão, fragmentos de herói, molduras e título Campeão de Eldoria. Ainda não há prêmios ativos."
  }
];

export { EVENT_CATALOG };

function getStatus(definition, eventState, valhallaConfig) {
  if (definition.key === "angel_of_death") {
    const runtime = eventState?.event;
    if (!runtime) return { label: "Sincronizando", tone: "checking" };
    if (runtime.status === "active" && Number(runtime.boss_hp_remaining) <= 0) {
      return { label: "Chefe derrotado", tone: "closed" };
    }
    if (runtime.status === "completed") return { label: "Encerrado", tone: "closed" };
    if (runtime.status === "scheduled") return { label: "Agendado", tone: "scheduled" };
    if (runtime.status === "active") return { label: "Em andamento", tone: "live" };
    return { label: "Aguardando ciclo", tone: "checking" };
  }
  if (definition.key === "valhalla") {
    if (valhallaConfig?.active === true) return { label: "Ativo no servidor", tone: "live" };
    if (valhallaConfig?.active === false) return { label: "Desativado no servidor", tone: "closed" };
    return { label: "Verificando servidor", tone: "checking" };
  }
  return { label: "Em preparação", tone: "planned" };
}

export function getEventPresentation({ eventState = null, valhallaConfig = null } = {}) {
  return EVENT_CATALOG.map(definition => ({
    ...definition,
    status: getStatus(definition, eventState, valhallaConfig),
    rewardText: definition.rewardMode === "conditional" && valhallaConfig?.active === true
      ? `Modo ativo: ${Number(valhallaConfig.dailyRunesReward || 0).toLocaleString("pt-BR")} Runas diárias configuradas pelo servidor, além do catálogo sazonal.`
      : definition.rewardText
  }));
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = String(text);
  return element;
}

export function renderWorldEventCards({ eventState = null, valhallaConfig = null } = {}) {
  const root = document.getElementById("worldEventGrid");
  if (!root) return;
  root.replaceChildren();
  const presentations = new Map(getEventPresentation({ eventState, valhallaConfig }).map(item => [item.key, item]));

  for (const event of EVENT_CATALOG) {
    const presentation = presentations.get(event.key);
    const article = makeElement("article", "world-event-card");
    article.dataset.eventKey = event.key;
    article.dataset.rewardMode = event.rewardMode;

    const artwork = makeElement("img", "world-event-art");
    artwork.src = event.image;
    artwork.alt = event.imageAlt;
    artwork.width = 640;
    artwork.height = 360;
    artwork.loading = "lazy";
    artwork.decoding = "async";

    const body = makeElement("div", "world-event-body");
    const top = makeElement("div", "world-event-topline");
    top.append(
      makeElement("span", "world-event-kicker", event.epithet),
      makeElement("span", "world-event-status tone-" + presentation.status.tone, presentation.status.label)
    );
    const title = makeElement("h3", "world-event-title", event.name);
    const description = makeElement("p", "world-event-description", event.description);
    const reward = makeElement("p", "world-event-reward", presentation.rewardText);
    reward.append(makeElement("span", "world-event-reward-label",
      event.rewardMode === "actual" ? "Prêmios do servidor" :
      event.rewardMode === "conditional" ? "Prêmios condicionais" : "Prévia de prêmios"));

    body.append(top, title, description, reward);
    if (event.href) {
      const action = makeElement("a", "world-event-action", event.action);
      action.href = event.href;
      body.append(action);
    } else {
      body.append(makeElement("span", "world-event-action is-disabled", "Integração em preparação"));
    }

    article.append(artwork, body);
    root.append(article);
  }
  root.setAttribute("aria-busy", "false");
}

export async function loadValhallaEventConfig() {
  try {
    const response = await fetch("/api/config/valhalla", {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return null;
    const config = await response.json();
    if (typeof config?.active !== "boolean") return null;
    return {
      active: config.active,
      dailyRunesReward: Math.max(0, Math.floor(Number(config.dailyRunesReward) || 0))
    };
  } catch {
    return null;
  }
}
