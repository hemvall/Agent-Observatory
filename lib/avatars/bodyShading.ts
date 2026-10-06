export type BodyShadingStop = { offset: number; color: string };

type Hsl = { hue: number; saturation: number; lightness: number };

type ShadingLayer = {
  offset: number;
  hueShift: number;
  saturationScale: number;
  lift: number;
};

/** Highlight, body color, terminator, then a bounce light on the far edge. */
const shadingLayers: readonly ShadingLayer[] = [
  { offset: 0, hueShift: 14, saturationScale: 0.84, lift: 0.34 },
  { offset: 0.22, hueShift: 7, saturationScale: 0.94, lift: 0.16 },
  { offset: 0.5, hueShift: 0, saturationScale: 1, lift: 0 },
  { offset: 0.76, hueShift: -8, saturationScale: 1.05, lift: -0.15 },
  { offset: 0.92, hueShift: -13, saturationScale: 1.08, lift: -0.25 },
  { offset: 1, hueShift: -16, saturationScale: 1.1, lift: -0.12 },
];

/** Anchored to the viewBox, not to each path, so every primitive shares one light source. */
export const bodyShadingUnits = "userSpaceOnUse";
export const bodyShadingCenter = { x: -42, y: -48 } as const;
export const bodyShadingRadius = 215;
export const bodyShadingOffsets = shadingLayers.map((layer) => layer.offset);

const bounded = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const readHexChannels = (color: string) => {
  const value = color.trim().replace("#", "");
  const expanded =
    value.length === 3
      ? [...value].map((channel) => channel + channel).join("")
      : value;
  const numeric = Number.parseInt(expanded.slice(0, 6), 16);
  if (expanded.length < 6 || !Number.isFinite(numeric)) return null;
  return [(numeric >> 16) & 255, (numeric >> 8) & 255, numeric & 255];
};

const toHsl = ([red, green, blue]: number[]): Hsl => {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { hue: 0, saturation: 0, lightness };
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  const sector =
    max === r
      ? (g - b) / delta + (g < b ? 6 : 0)
      : max === g
        ? (b - r) / delta + 2
        : (r - g) / delta + 4;
  return { hue: sector * 60, saturation, lightness };
};

const toHex = ({ hue, saturation, lightness }: Hsl) => {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sector = (((hue % 360) + 360) % 360) / 60;
  const second = chroma * (1 - Math.abs((sector % 2) - 1));
  const rgb =
    sector < 1
      ? [chroma, second, 0]
      : sector < 2
        ? [second, chroma, 0]
        : sector < 3
          ? [0, chroma, second]
          : sector < 4
            ? [0, second, chroma]
            : sector < 5
              ? [second, 0, chroma]
              : [chroma, 0, second];
  const match = lightness - chroma / 2;
  return `#${rgb
    .map((channel) =>
      Math.round(bounded((channel + match) * 255, 0, 255))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
};

/** Toward white above zero, toward black below. */
const liftLightness = (lightness: number, lift: number) =>
  lift >= 0 ? lightness + (1 - lightness) * lift : lightness * (1 + lift);

/** Below this, hue shifts are skipped so greys stay grey. */
const neutralSaturation = 0.12;

const applyLayer = (base: Hsl, layer: ShadingLayer) =>
  toHex({
    hue: base.hue + (base.saturation > neutralSaturation ? layer.hueShift : 0),
    saturation:
      base.saturation > neutralSaturation
        ? bounded(base.saturation * layer.saturationScale, 0, 1)
        : 0,
    lightness: bounded(liftLightness(base.lightness, layer.lift), 0, 1),
  });

export const bodyShadingStops = (bodyColor: string): BodyShadingStop[] => {
  const channels = readHexChannels(bodyColor);
  if (!channels)
    return shadingLayers.map((layer) => ({
      offset: layer.offset,
      color: bodyColor,
    }));
  const base = toHsl(channels);
  return shadingLayers.map((layer) => ({
    offset: layer.offset,
    color: applyLayer(base, layer),
  }));
};

export const bodyShadingStopColor = (bodyColor: string, index: number) => {
  const layer = shadingLayers[index];
  if (!layer) return bodyColor;
  const channels = readHexChannels(bodyColor);
  return channels ? applyLayer(toHsl(channels), layer) : bodyColor;
};

/** For the string-built SVGs: snapshot export and standalone runtime. */
export const bodyShadingMarkup = (id: string, bodyColor: string) =>
  `<radialGradient id="${id}" gradientUnits="${bodyShadingUnits}" cx="${bodyShadingCenter.x}" cy="${bodyShadingCenter.y}" r="${bodyShadingRadius}">${bodyShadingStops(
    bodyColor,
  )
    .map((stop) => `<stop offset="${stop.offset}" stop-color="${stop.color}"/>`)
    .join("")}</radialGradient>`;
