export interface Point2D {
  x: number;
  y: number;
}

export interface TransformationConfig {
  videoWidth: number;
  videoHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  isMirrored: boolean; // Front camera flip
  objectFit?: 'cover' | 'contain' | 'fill';
}

export class CoordinateTransformer {
  /**
   * Transforms normalized MediaPipe coordinates ([0.0, 1.0]) to exact HTML5 Canvas pixel coordinates.
   * Solves two critical spatial alignment problems:
   * 1. Horizontal mirroring: Front selfie camera is mirrored horizontally (x' = 1 - x).
   * 2. Aspect-ratio mismatch: Webcams are usually 16:9 (1280x720) while browser windows vary.
   *    Uses 'cover' scaling and crop offsets so video & hand landmarks align 1:1 on screen.
   */
  public static normalizedToCanvasPoint(
    normalizedPoint: Point2D,
    config: TransformationConfig
  ): Point2D {
    const { videoWidth, videoHeight, canvasWidth, canvasHeight, isMirrored, objectFit = 'cover' } = config;

    // Guard against uninitialized dimensions (0 or negative)
    if (videoWidth <= 0 || videoHeight <= 0 || canvasWidth <= 0 || canvasHeight <= 0) {
      return { x: 0, y: 0 };
    }

    // 1. Mirror X-axis for front camera so the interface acts like a natural mirror
    let normX = normalizedPoint.x;
    if (isMirrored) {
      normX = 1.0 - normX;
    }
    const normY = normalizedPoint.y;

    // Simple stretch (fill) without aspect ratio preservation
    if (objectFit === 'fill') {
      return {
        x: normX * canvasWidth,
        y: normY * canvasHeight,
      };
    }

    // 2. Aspect Ratio Preserving Geometry (object-fit: cover):
    // Compare canvas aspect ratio to native video aspect ratio
    const videoAspect = videoWidth / videoHeight;
    const canvasAspect = canvasWidth / canvasHeight;

    let renderWidth = canvasWidth;
    let renderHeight = canvasHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (objectFit === 'cover') {
      if (canvasAspect > videoAspect) {
        // Canvas is wider than video: scale video to match canvas width, crop excess top & bottom
        renderHeight = canvasWidth / videoAspect;
        offsetY = (canvasHeight - renderHeight) / 2; // Center vertically
      } else {
        // Canvas is taller than video: scale video to match canvas height, crop excess left & right
        renderWidth = canvasHeight * videoAspect;
        offsetX = (canvasWidth - renderWidth) / 2; // Center horizontally
      }
    } else if (objectFit === 'contain') {
      if (canvasAspect > videoAspect) {
        // Pillarbox left/right black bars
        renderWidth = canvasHeight * videoAspect;
        offsetX = (canvasWidth - renderWidth) / 2;
      } else {
        // Letterbox top/bottom black bars
        renderHeight = canvasWidth / videoAspect;
        offsetY = (canvasHeight - renderHeight) / 2;
      }
    }

    // 3. Project normalized coordinates to final pixel coordinates
    const pixelX = offsetX + normX * renderWidth;
    const pixelY = offsetY + normY * renderHeight;

    return { x: pixelX, y: pixelY };
  }
}
