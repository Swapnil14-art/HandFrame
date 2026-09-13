import { BaseFilter } from '../types/FilterTypes';

export class CutoutFilter implements BaseFilter {
  readonly id = 'cutout';
  readonly displayName = 'Cutout';
  readonly description = 'Cardboard cutout illusion with a pure black exterior and live camera view inside the HandFrame.';
  readonly category = 'Effect' as const;
  readonly version = '1.0.0';
  readonly isCutout = true;

  apply(imageData: ImageData): ImageData {
    // Preserves original camera colors, brightness, and sharpness inside the frame
    return imageData;
  }
}
