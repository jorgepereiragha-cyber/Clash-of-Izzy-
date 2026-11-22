// Deriva mapas de normal tangente e rugosidade a partir de uma altura tileable.
// Os dados sao lineares (nao sRGB) e limitados para nao exceder o orçamento de memoria.
const ROUGHNESS_BY_KIND = Object.freeze({
  grass: 0.98,
  road: 0.94,
  stone: 0.91,
  wood: 0.88,
  roof: 0.79
});

const NORMAL_STRENGTH_BY_KIND = Object.freeze({
  grass: 1.8,
  road: 1.7,
  stone: 2.25,
  wood: 2.0,
  roof: 1.95
});

export function derivePbrTextureData({ luminance, width, height, kind = "stone" } = {}) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2 || width > 2048 || height > 2048) {
    throw new RangeError("Dimensoes de textura PBR invalidas.");
  }
  if (!luminance || luminance.length !== width * height) {
    throw new TypeError("A luminancia deve conter um valor por pixel.");
  }

  const roughnessBase = ROUGHNESS_BY_KIND[kind] ?? ROUGHNESS_BY_KIND.stone;
  const normalStrength = NORMAL_STRENGTH_BY_KIND[kind] ?? NORMAL_STRENGTH_BY_KIND.stone;
  const normalData = new Uint8ClampedArray(width * height * 4);
  const roughnessData = new Uint8ClampedArray(width * height * 4);
  const sample = (x, y) => {
    const wrappedX = (x + width) % width;
    const wrappedY = (y + height) % height;
    return Math.max(0, Math.min(255, Number(luminance[wrappedY * width + wrappedX]) || 0)) / 255;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const offset = index * 4;
      const center = sample(x, y);
      const dx = sample(x + 1, y) - sample(x - 1, y);
      const dy = sample(x, y + 1) - sample(x, y - 1);

      // Y e invertido porque a origem da imagem Canvas fica no canto superior.
      const nx = -dx * normalStrength;
      const ny = dy * normalStrength;
      const length = Math.hypot(nx, ny, 1);
      normalData[offset] = Math.round((nx / length * 0.5 + 0.5) * 255);
      normalData[offset + 1] = Math.round((ny / length * 0.5 + 0.5) * 255);
      normalData[offset + 2] = Math.round((1 / length * 0.5 + 0.5) * 255);
      normalData[offset + 3] = 255;

      const edge = Math.min(0.12, (Math.abs(dx) + Math.abs(dy)) * 0.3);
      const roughness = Math.max(0.55, Math.min(1, roughnessBase + (0.5 - center) * 0.08 + edge));
      const roughnessByte = Math.round(roughness * 255);
      roughnessData[offset] = roughnessByte;
      roughnessData[offset + 1] = roughnessByte;
      roughnessData[offset + 2] = roughnessByte;
      roughnessData[offset + 3] = 255;
    }
  }

  return Object.freeze({ normalData, roughnessData });
}
