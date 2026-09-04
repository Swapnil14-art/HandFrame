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
   * Transforms normalized MediaPipe landmark (0.0 to 1.0) to pixel canvas coordinates.
   * Accounts for object-fit cover cropping and horizontal front-camera mirroring.
   */
  public static normalizedToCanvasPoint(
    normalizedPoint: Point2D,
    config: TransformationConfig
  ): Point2D {
    const { videoWidth, videoHeight, canvasWidth, canvasHeight, isMirrored, objectFit = 'cover' } = config;

    if (videoWidth <= 0 || videoHeight <= 0 || canvasWidth <= 0 || canvasHeight <= 0) {
      return { x: 0, y: 0 };
    }

    // 1. Account for horizontal mirror flipping on front camera
    let normX = normalizedPoint.x;
    if (isMirrored) {
      normX = 1.0 - normX;
    }
    const normY = normalizedPoint.y;

    if (objectFit === 'fill') {
      return {
        x: normX * canvasWidth,
        y: normY * canvasHeight,
      };
    }

    // Aspect ratio calculation for 'cover' (default)
    const videoAspect = videoWidth / videoHeight;
    const canvasAspect = canvasWidth / canvasHeight;

    let renderWidth = canvasWidth;
    let renderHeight = canvasHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (objectFit === 'cover') {
      if (canvasAspect > videoAspect) {
        // Canvas is wider than video -> scale by width, crop top/bottom
        renderHeight = canvasWidth / videoAspect;
        offsetY = (canvasHeight - renderHeight) / 2;
      } else {
        // Canvas is taller than video -> scale by height, crop left/right
        renderWidth = canvasHeight * videoAspect;
        offsetX = (canvasWidth - renderWidth) / 2;
      }
    } else if (objectFit === 'contain') {
      if (canvasAspect > videoAspect) {
        // Scale by height, pillarbox left/right
        renderWidth = canvasHeight * videoAspect;
        offsetX = (canvasWidth - renderWidth) / 2;
      } else {
        // Scale by width, letterbox top/bottom
        renderHeight = canvasWidth / videoAspect;
        offsetY = (canvasHeight - renderHeight) / 2;
      }
    }

    const pixelX = offsetX + normX * renderWidth;
    const pixelY = offsetY + normY * renderHeight;

    return { x: pixelX, y: pixelY };
  }
}
