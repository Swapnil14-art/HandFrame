import { BaseFilter } from '../types/FilterTypes';

export class RageShiftFilter implements BaseFilter {
  public id = 'rage_shift';
  public displayName = 'Rage Shift';
  public description = 'Rapid discrete frame-by-frame anime rage shock treatments changing 10x per second';
  public category = 'Artistic' as const;
  public version = '2.0.0';

  public apply(imageData: ImageData): ImageData {
    const { width, height, data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), width, height);
    const outData = output.data;

    // Discrete state index switching every 100ms (10 times per second)
    const stateIndex = Math.floor(Date.now() / 100) % 10;
    const len = data.length;

    for (let i = 0; i < len; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      let outR = 0, outG = 0, outB = 0;

      switch (stateIndex) {
        case 0: {
          // Heatmap: Blue -> Magenta -> Red -> Yellow -> White
          if (lum < 64) {
            outR = Math.round(lum * 3);
            outG = 0;
            outB = Math.round(180 - lum * 2);
          } else if (lum < 160) {
            outR = 255;
            outG = Math.round((lum - 64) * 2.2);
            outB = 0;
          } else {
            outR = 255;
            outG = 255;
            outB = Math.round((lum - 160) * 2.5);
          }
          break;
        }
        case 1: {
          // Harsh Black & White Ink
          const bw = lum > 115 ? 255 : 0;
          outR = bw;
          outG = bw;
          outB = bw;
          break;
        }
        case 2: {
          // Inverted High-Contrast Red & Black
          const inv = 255 - lum;
          outR = Math.min(255, inv * 1.8);
          outG = 0;
          outB = 0;
          break;
        }
        case 3: {
          // Blue & White Thermal Inversion
          outR = Math.round(lum * 0.2);
          outG = Math.round(120 + lum * 0.5);
          outB = 255;
          break;
        }
        case 4: {
          // Negative Cyan Outline Silhouette
          const sil = lum < 90 ? 0 : 255;
          outR = 0;
          outG = sil;
          outB = sil;
          break;
        }
        case 5: {
          // Posterized Manga Monochrome (4-tier harsh gray)
          const tier = Math.floor(lum / 64) * 85;
          outR = tier;
          outG = tier;
          outB = tier;
          break;
        }
        case 6: {
          // High-Contrast Crimson Edge Map
          const redVal = lum > 140 ? 255 : lum * 0.4;
          outR = redVal;
          outG = 0;
          outB = 0;
          break;
        }
        case 7: {
          // Solarized Yellow & Black Threshold
          const sol = (lum > 70 && lum < 180) ? 255 : 0;
          outR = sol;
          outG = sol;
          outB = 0;
          break;
        }
        case 8: {
          // Dark Cinematic High Contrast
          const cin = lum < 100 ? lum * 0.2 : 255;
          outR = cin;
          outG = cin;
          outB = Math.min(255, cin + 20);
          break;
        }
        case 9: default: {
          // White-Outline-on-Pitch-Black
          const edgeVal = lum > 100 ? 255 : 0;
          outR = edgeVal;
          outG = edgeVal;
          outB = edgeVal;
          break;
        }
      }

      outData[i]     = Math.min(255, Math.max(0, outR));
      outData[i + 1] = Math.min(255, Math.max(0, outG));
      outData[i + 2] = Math.min(255, Math.max(0, outB));
    }

    return output;
  }
}
