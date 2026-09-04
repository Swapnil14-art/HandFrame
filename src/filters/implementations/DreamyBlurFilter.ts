import { BaseFilter } from '../types/FilterTypes';

export class DreamyBlurFilter implements BaseFilter {
  readonly id = 'dreamy_blur';
  readonly displayName = 'Dreamy Blur';
  readonly description = 'Soft bloom diffusion with highlight glow and dreamy soft focus.';
  readonly category = 'Dreamy' as const;
  readonly version = '1.0.0';

  apply(imageData: ImageData): ImageData {
    const width = imageData.width;
    const height = imageData.height;
    const src = imageData.data;

    // Fast 3x3 box blur pass mixed with highlight bloom
    const copy = new Uint8ClampedArray(src);

    for (let y = 1; y < height - 1; y += 2) {
      for (let x = 1; x < width - 1; x += 2) {
        const idx = (y * width + x) * 4;

        // Neighbor averages
        let sumR = 0, sumG = 0, sumB = 0;
        let count = 0;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nIdx = ((y + dy) * width + (x + dx)) * 4;
            sumR += copy[nIdx];
            sumG += copy[nIdx + 1];
            sumB += copy[nIdx + 2];
            count++;
          }
        }

        const avgR = sumR / count;
        const avgG = sumG / count;
        const avgB = sumB / count;

        // Blend blurred pixel with soft bloom highlights
        const origR = src[idx];
        const origG = src[idx + 1];
        const origB = src[idx + 2];

        // Bloom boost
        const bloom = (origR + origG + origB) > 400 ? 1.25 : 1.05;

        src[idx] = Math.min(255, (origR * 0.4 + avgR * 0.6) * bloom);
        src[idx + 1] = Math.min(255, (origG * 0.4 + avgG * 0.6) * bloom);
        src[idx + 2] = Math.min(255, (origB * 0.4 + avgB * 0.6) * bloom + 10); // Soft violet/blue touch
      }
    }

    return imageData;
  }
}
