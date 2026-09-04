import { BaseFilter } from '../types/FilterTypes';

export class SketchFilter implements BaseFilter {
  public id = 'sketch';
  public displayName = 'Hand Drawn';
  public description = 'Hand-drawn ink & pencil sketch aesthetic on textured paper preserving facial & structural features';
  public category = 'Artistic' as const;
  public version = '1.0.0';

  public apply(imageData: ImageData): ImageData {
    const { width, height, data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), width, height);
    const outData = output.data;

    // Convert to grayscale luminance
    const gray = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const outIdx = (y * width + x) * 4;
        const lum = gray[y * width + x];

        // Sobel structural edge calculation
        const gx = -gray[(y - 1) * width + (x - 1)] + gray[(y - 1) * width + (x + 1)] -
                   2 * gray[y * width + (x - 1)] + 2 * gray[y * width + (x + 1)] -
                   gray[(y + 1) * width + (x - 1)] + gray[(y + 1) * width + (x + 1)];

        const gy = -gray[(y - 1) * width + (x - 1)] - 2 * gray[(y - 1) * width + x] - gray[(y - 1) * width + (x + 1)] +
                   gray[(y + 1) * width + (x - 1)] + 2 * gray[(y + 1) * width + x] + gray[(y + 1) * width + (x + 1)];

        const edgeMag = Math.sqrt(gx * gx + gy * gy);

        // Textured sketch paper base color (Warm Cream Paper: #FAF6EE)
        let paperR = 250;
        let paperG = 246;
        let paperB = 238;

        // Subtle paper grain noise
        const noise = ((x * 13 + y * 29) % 11) - 5;
        paperR = Math.min(255, Math.max(0, paperR + noise));
        paperG = Math.min(255, Math.max(0, paperG + noise));
        paperB = Math.min(255, Math.max(0, paperB + noise));

        if (edgeMag > 38) {
          // Sharp Ink stroke for structural outlines (eyes, nose, lips, fingers, clothing edges)
          const inkIntensity = Math.min(200, Math.max(0, (edgeMag - 38) * 3));
          paperR = Math.max(20, paperR - inkIntensity);
          paperG = Math.max(20, paperG - inkIntensity);
          paperB = Math.max(25, paperB - inkIntensity * 0.9);
        } else if (lum < 95) {
          // Pencil cross-hatch shading in deep shadow regions
          const hatchPattern = (x + y) % 4 === 0 || (x - y) % 4 === 0;
          if (hatchPattern) {
            const shadeVal = Math.round((95 - lum) * 1.2);
            paperR = Math.max(40, paperR - shadeVal);
            paperG = Math.max(40, paperG - shadeVal);
            paperB = Math.max(45, paperB - shadeVal);
          }
        }

        outData[outIdx]     = paperR;
        outData[outIdx + 1] = paperG;
        outData[outIdx + 2] = paperB;
      }
    }

    return output;
  }
}
