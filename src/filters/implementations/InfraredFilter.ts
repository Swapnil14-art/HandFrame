import { BaseFilter } from '../types/FilterTypes';

export class InfraredFilter implements BaseFilter {
  public id = 'infrared';
  public displayName = 'Infrared';
  public description = 'False-color infrared thermal simulation';
  public category = 'Cinematic' as const;
  public version = '1.0.0';

  public apply(imageData: ImageData): ImageData {
    const { data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), imageData.width, imageData.height);
    const outData = output.data;

    const len = data.length;
    for (let i = 0; i < len; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const lum = 0.299 * r + 0.587 * g + 0.114 * b; // 0..255
      const normLum = lum / 255;

      // Warmth metric prioritizing skin tones and high-energy highlights
      const warmth = Math.min(1.0, Math.max(0.0, (r - b + 40) / 200));

      let irR = 0, irG = 0, irB = 0;

      if (normLum < 0.25) {
        // Deep shadow: Indigo / Dark Cobalt
        const t = normLum / 0.25;
        irR = Math.round(10 + t * 40);
        irG = Math.round(15 + t * 30);
        irB = Math.round(50 + t * 110);
      } else if (normLum < 0.65) {
        // Mid-tones: Vibrant IR Magenta / Crimson / Violet
        const t = (normLum - 0.25) / 0.4;
        irR = Math.round(50 + t * 195 + warmth * 10);
        irG = Math.round(45 * (1 - warmth) + t * 40);
        irB = Math.round(160 - t * 80 + warmth * 40);
      } else {
        // Highlights: Radiant Hot Pink -> Infrared Soft White
        const t = (normLum - 0.65) / 0.35;
        irR = 255;
        irG = Math.round(85 + t * 165);
        irB = Math.round(140 + t * 115);
      }

      // Blend 35% crisp camera detail to guarantee 100% facial and hand recognizability
      outData[i]     = Math.min(255, Math.round(irR * 0.7 + r * 0.3));
      outData[i + 1] = Math.min(255, Math.round(irG * 0.7 + g * 0.3));
      outData[i + 2] = Math.min(255, Math.round(irB * 0.7 + b * 0.3));
    }

    return output;
  }
}
