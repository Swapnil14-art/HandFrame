import { BaseFilter } from '../types/FilterTypes';

export class SketchFilter implements BaseFilter {
  public id = 'sketch';
  public displayName = 'Hand Drawn';
  public description = 'Hand-drawn ink & pencil sketch aesthetic on textured paper with refined contour detail';
  public category = 'Artistic' as const;
  public version = '1.1.0';

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
        const gx =
          -gray[(y - 1) * width + (x - 1)] + gray[(y - 1) * width + (x + 1)] -
          2 * gray[y * width + (x - 1)] + 2 * gray[y * width + (x + 1)] -
          gray[(y + 1) * width + (x - 1)] + gray[(y + 1) * width + (x + 1)];

        const gy =
          -gray[(y - 1) * width + (x - 1)] - 2 * gray[(y - 1) * width + x] - gray[(y - 1) * width + (x + 1)] +
          gray[(y + 1) * width + (x - 1)] + 2 * gray[(y + 1) * width + x] + gray[(y + 1) * width + (x + 1)];

        const edgeMag = Math.sqrt(gx * gx + gy * gy);

        // Textured sketch paper base color (Warm Cream Paper: #FAF6EE)
        let paperR = 250;
        let paperG = 246;
        let paperB = 238;

        // Deterministic high-frequency paper grain noise (simulates rough cellulose paper texture)
        const noise = ((x * 13 + y * 29) % 11) - 5;
        paperR = Math.min(255, Math.max(0, paperR + noise));
        paperG = Math.min(255, Math.max(0, paperG + noise));
        paperB = Math.min(255, Math.max(0, paperB + noise));

        // Dual-Tier Edge Rendering:
        if (edgeMag > 28) {
          if (edgeMag > 45) {
            // Tier 1: Bold black ink stroke for dominant contours (eyes, lips, fingers, silhouette)
            const inkIntensity = Math.min(210, Math.max(0, (edgeMag - 28) * 2.8));
            paperR = Math.max(18, paperR - inkIntensity);
            paperG = Math.max(18, paperG - inkIntensity);
            paperB = Math.max(22, paperB - inkIntensity * 0.9);
          } else {
            // Tier 2: Fine 2H graphite pencil stroke for subtle anatomical/clothing details
            const pencilIntensity = Math.min(130, Math.max(0, (edgeMag - 28) * 2.2));
            paperR = Math.max(45, paperR - pencilIntensity);
            paperG = Math.max(42, paperG - pencilIntensity);
            paperB = Math.max(48, paperB - pencilIntensity * 0.85);
          }
        } else if (lum < 110) {
          // Cross-hatch shading in shadow regions:
          // Creates diagonal 45-degree hatch lines using modular arithmetic (x ± y) % 4 === 0
          const hatchPattern = (x + y) % 4 === 0 || (x - y) % 4 === 0;
          if (hatchPattern) {
            const shadeVal = Math.round((110 - lum) * 1.1);
            paperR = Math.max(38, paperR - shadeVal);
            paperG = Math.max(38, paperG - shadeVal);
            paperB = Math.max(42, paperB - shadeVal);
          }
        }

        outData[outIdx]     = paperR;
        outData[outIdx + 1] = paperG;
        outData[outIdx + 2] = paperB;
        outData[outIdx + 3] = 255;
      }
    }

    return output;
  }
}
