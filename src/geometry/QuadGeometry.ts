import { Point2D } from '../camera/CoordinateTransformer';

export interface QuadPolygon {
  P1: Point2D; // LEFT_THUMB
  P2: Point2D; // LEFT_INDEX
  P3: Point2D; // RIGHT_INDEX
  P4: Point2D; // RIGHT_THUMB
}

export class QuadGeometry {
  /**
   * Adaptive velocity-aware temporal smoothing.
   * Dynamically adjusts alpha based on velocity to eliminate static jitter while keeping zero movement lag.
   */
  public static smoothQuad(
    current: QuadPolygon,
    previous: QuadPolygon | null,
    minAlpha: number = 0.3,
    maxAlpha: number = 0.85
  ): QuadPolygon {
    if (!previous) return current;

    // Calculate maximum movement speed among all 4 points
    const d1 = this.dist(current.P1, previous.P1);
    const d2 = this.dist(current.P2, previous.P2);
    const d3 = this.dist(current.P3, previous.P3);
    const d4 = this.dist(current.P4, previous.P4);
    const maxMove = Math.max(d1, d2, d3, d4);

    // Dynamic alpha: slow movement = minAlpha (silky smooth), fast movement = maxAlpha (instant response)
    const velocityFactor = Math.min(1.0, maxMove / 45.0); // 45px speed cap
    const alpha = minAlpha + (maxAlpha - minAlpha) * velocityFactor;

    return {
      P1: {
        x: previous.P1.x + (current.P1.x - previous.P1.x) * alpha,
        y: previous.P1.y + (current.P1.y - previous.P1.y) * alpha,
      },
      P2: {
        x: previous.P2.x + (current.P2.x - previous.P2.x) * alpha,
        y: previous.P2.y + (current.P2.y - previous.P2.y) * alpha,
      },
      P3: {
        x: previous.P3.x + (current.P3.x - previous.P3.x) * alpha,
        y: previous.P3.y + (current.P3.y - previous.P3.y) * alpha,
      },
      P4: {
        x: previous.P4.x + (current.P4.x - previous.P4.x) * alpha,
        y: previous.P4.y + (current.P4.y - previous.P4.y) * alpha,
      },
    };
  }

  /**
   * Calculates quadrilateral surface area using Shoelace formula.
   */
  public static getPolygonArea(quad: QuadPolygon): number {
    const { P1, P2, P3, P4 } = quad;
    return Math.abs(
      0.5 *
        (P1.x * P2.y +
          P2.x * P3.y +
          P3.x * P4.y +
          P4.x * P1.y -
          (P2.x * P1.y + P3.x * P2.y + P4.x * P3.y + P1.x * P4.y))
    );
  }

  /**
   * Calculates bounding box around quadrilateral to define canvas sub-region bounds.
   */
  public static getBoundingBox(
    quad: QuadPolygon,
    canvasWidth: number,
    canvasHeight: number
  ): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } {
    const xs = [quad.P1.x, quad.P2.x, quad.P3.x, quad.P4.x];
    const ys = [quad.P1.y, quad.P2.y, quad.P3.y, quad.P4.y];

    let minX = Math.floor(Math.min(...xs));
    let minY = Math.floor(Math.min(...ys));
    let maxX = Math.ceil(Math.max(...xs));
    let maxY = Math.ceil(Math.max(...ys));

    // Clamp to canvas boundaries
    minX = Math.max(0, minX);
    minY = Math.max(0, minY);
    maxX = Math.min(canvasWidth, maxX);
    maxY = Math.min(canvasHeight, maxY);

    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);

    return { minX, minY, maxX, maxY, width, height };
  }

  private static dist(a: Point2D, b: Point2D): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
