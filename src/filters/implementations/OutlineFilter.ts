import { BaseFilter } from '../types/FilterTypes';

export class OutlineFilter implements BaseFilter {
  public id = 'outline';
  public displayName = 'Outline';
  public description = 'High-contrast Sobel edge-art vector lines highlighting facial, hand, and object contours';
  public category = 'Artistic' as const;
  public version = '1.0.0';

  public apply(imageData: ImageData): ImageData {
    const { width, height, data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), width, height);
    const outData = output.data;

    // 1. Convert RGB image to grayscale luminance using standard perceptual weights:
    // Human eyes are most sensitive to Green (58.7%), then Red (29.9%), then Blue (11.4%)
    const gray = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }

    // 2. Sobel 3x3 Discrete Differentiation Operator:
    // Gx detects vertical brightness transitions (horizontal gradient):
    // [-1  0  +1]
    // [-2  0  +2]
    // [-1  0  +1]
    // Gy detects horizontal brightness transitions (vertical gradient):
    // [-1 -2  -1]
    // [ 0  0   0]
    // [+1 +2  +1]

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        // Precompute 3x3 neighbor indices
        const idx00 = (y - 1) * width + (x - 1);
        const idx01 = (y - 1) * width + x;
        const idx02 = (y - 1) * width + (x + 1);

        const idx10 = y * width + (x - 1);
        const idx12 = y * width + (x + 1);

        const idx20 = (y + 1) * width + (x - 1);
        const idx21 = (y + 1) * width + x;
        const idx22 = (y + 1) * width + (x + 1);

        // Convolution with Gx kernel
        const gx =
          -gray[idx00] + gray[idx02] -
          2 * gray[idx10] + 2 * gray[idx12] -
          gray[idx20] + gray[idx22];

        // Convolution with Gy kernel
        const gy =
          -gray[idx00] - 2 * gray[idx01] - gray[idx02] +
          gray[idx20] + 2 * gray[idx21] + gray[idx22];

        // Gradient vector magnitude (Euclidean length): represents edge strength
        const mag = Math.sqrt(gx * gx + gy * gy);

        // Edge threshold curve: subtract noise floor (25) and amplify strong structural edges
        const edgeIntensity = Math.min(255, Math.max(0, (mag - 25) * 2.2));

        const outIdx = (y * width + x) * 4;
        const origR = data[outIdx];
        const origG = data[outIdx + 1];
        const origB = data[outIdx + 2];

        // Aesthetic composite: Dim background (15%) + Glowing Cyan/White edge lines
        const baseDarkR = origR * 0.15;
        const baseDarkG = origG * 0.18;
        const baseDarkB = origB * 0.22;

        outData[outIdx]     = Math.min(255, baseDarkR + edgeIntensity * 0.85);
        outData[outIdx + 1] = Math.min(255, baseDarkG + edgeIntensity * 1.0);
        outData[outIdx + 2] = Math.min(255, baseDarkB + edgeIntensity * 0.95);
      }
    }

    return output;
  }
}
