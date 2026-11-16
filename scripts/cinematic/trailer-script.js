export const TRAILER_SCRIPT = Object.freeze({
  title: "Clash of Izzy — Ascensão de Valhalla",
  duration: 60,
  scenes: [
    {
      id: "opening",
      description: "Aproximação cinematográfica da cidade",
      camera: [
        { time: 0, position: [10, 18, 16], lookAt: [0, 0, 0], zoom: 0.72 },
        { time: 4, position: [7, 14, 12], lookAt: [0, 0, 0], zoom: 0.86 },
        { time: 8, position: [10, 13, 11], lookAt: [0, 0.2, 0], zoom: 1 }
      ]
    },
    {
      id: "kingdom_tour",
      description: "Visão panorâmica das construções do reino",
      camera: [
        { time: 8, position: [10, 13, 11], lookAt: [0, 0.2, 0], zoom: 1 },
        { time: 11, position: [-10, 12, 9], lookAt: [0, 0.4, 0], zoom: 1.08 },
        { time: 14, position: [-9, 10, -9], lookAt: [0, 0.5, 0], zoom: 1.05 },
        { time: 18, position: [9, 12, -8], lookAt: [0, 0.4, 0], zoom: 1 }
      ],
      text: {
        content: "CONSTRUA SEU REINO",
        position: "center",
        startTime: 10,
        endTime: 16,
        style: "epic"
      }
    },
    {
      id: "army_showcase",
      description: "Destaque das áreas militares e tropas disponíveis",
      camera: [
        { time: 18, position: [9, 12, -8], lookAt: [0, 0.4, 0], zoom: 1 },
        { time: 21, position: [1, 9, 9], lookAt: [-4, 1, -2], zoom: 1.28 },
        { time: 24, position: [-9, 8, 5], lookAt: [-4, 1, -2], zoom: 1.42 },
        { time: 28, position: [10, 13, 11], lookAt: [0, 0.2, 0], zoom: 1 }
      ],
      text: {
        content: "EVOLUA SEU EXÉRCITO",
        position: "bottom",
        startTime: 20,
        endTime: 26,
        style: "legendary"
      }
    },
    {
      id: "war_preparation",
      description: "Movimento de câmera sobre o reino preparado para a guerra",
      camera: [
        { time: 28, position: [10, 13, 11], lookAt: [0, 0.2, 0], zoom: 1 },
        { time: 32, position: [5, 9, 8], lookAt: [4, 1, 0], zoom: 1.22 },
        { time: 36, position: [-6, 8, 7], lookAt: [0, 0.4, 0], zoom: 1.3 },
        { time: 40, position: [8, 14, -10], lookAt: [0, 0, 0], zoom: 0.96 },
        { time: 42, position: [8, 14, -10], lookAt: [0, 0, 0], zoom: 0.96 }
      ],
      text: {
        content: "PREPARE-SE PARA A GUERRA",
        position: "center",
        startTime: 30,
        endTime: 40,
        style: "action"
      }
    },
    {
      id: "alliances",
      description: "Plano aberto da cidade para apresentar o jogo em equipe",
      camera: [
        { time: 42, position: [8, 14, -10], lookAt: [0, 0, 0], zoom: 0.96 },
        { time: 46, position: [-10, 18, 0], lookAt: [0, 0, 0], zoom: 0.78 },
        { time: 50, position: [10, 13, 11], lookAt: [0, 0.2, 0], zoom: 1 }
      ],
      text: {
        content: "FORJE ALIANÇAS",
        position: "center",
        startTime: 44,
        endTime: 48,
        style: "epic"
      }
    },
    {
      id: "valhalla",
      description: "Mudança temporária para a iluminação de Valhalla",
      camera: [
        { time: 50, position: [10, 13, 11], lookAt: [0, 0.2, 0], zoom: 1, valhalla: true },
        { time: 53, position: [5, 12, 8], lookAt: [0, 0.5, 0], zoom: 1.18, valhalla: true },
        { time: 57, position: [0, 16, 18], lookAt: [0, 0.5, 0], zoom: 0.9, valhalla: false }
      ],
      text: {
        content: "ASCENDA A VALHALLA",
        position: "center",
        startTime: 52,
        endTime: 56,
        style: "legendary"
      }
    },
    {
      id: "cta",
      description: "Encerramento e chamada para jogar",
      camera: [
        { time: 57, position: [0, 16, 18], lookAt: [0, 0.5, 0], zoom: 0.9, valhalla: false },
        { time: 60, position: [0, 16, 18], lookAt: [0, 0.5, 0], zoom: 0.9, valhalla: false }
      ],
      text: {
        content: "JOGUE CLASH OF IZZY\nCONSTRUA. FORTALEÇA. CONQUISTE.",
        position: "center",
        startTime: 57,
        endTime: 60,
        style: "cta"
      }
    }
  ]
});

export const CINEMATIC_PRESETS = Object.freeze({
  epic_intro: {
    duration: 8,
    camera: [
      { time: 0, position: [10, 18, 16], lookAt: [0, 0, 0], zoom: 0.72 },
      { time: 4, position: [7, 14, 12], lookAt: [0, 0, 0], zoom: 0.86 },
      { time: 8, position: [10, 13, 11], lookAt: [0, 0.2, 0], zoom: 1 }
    ]
  },
  kingdom_tour: {
    duration: 16,
    camera: [
      { time: 0, position: [10, 13, 11], lookAt: [0, 0.2, 0], zoom: 1 },
      { time: 4, position: [-10, 12, 9], lookAt: [0, 0.4, 0], zoom: 1.08 },
      { time: 8, position: [-9, 10, -9], lookAt: [0, 0.5, 0], zoom: 1.05 },
      { time: 12, position: [9, 12, -8], lookAt: [0, 0.4, 0], zoom: 1 },
      { time: 16, position: [10, 13, 11], lookAt: [0, 0.2, 0], zoom: 1 }
    ]
  },
  battle_zoom: {
    duration: 10,
    camera: [
      { time: 0, position: [10, 18, 16], lookAt: [0, 0, 0], zoom: 0.72 },
      { time: 3, position: [5, 9, 8], lookAt: [4, 1, 0], zoom: 1.22 },
      { time: 6, position: [-6, 8, 7], lookAt: [0, 0.4, 0], zoom: 1.3 },
      { time: 10, position: [8, 14, -10], lookAt: [0, 0, 0], zoom: 0.96 }
    ]
  }
});

export function buildTrailerTimeline(script = TRAILER_SCRIPT, requestedDuration = script.duration) {
  const duration = Math.max(5, Math.min(180, Number(requestedDuration) || script.duration));
  const scale = duration / script.duration;
  const byTime = new Map();
  const textCues = [];

  for (const scene of script.scenes) {
    for (const frame of scene.camera) {
      byTime.set(frame.time * scale, { ...frame, time: frame.time * scale });
    }
    if (scene.text) {
      textCues.push({
        ...scene.text,
        startTime: scene.text.startTime * scale,
        endTime: scene.text.endTime * scale
      });
    }
  }

  return {
    duration,
    keyframes: [...byTime.values()].sort((a, b) => a.time - b.time),
    textCues
  };
}
