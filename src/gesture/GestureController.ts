import { Point2D } from '../camera/CoordinateTransformer';

export type GestureState = 'READY' | 'TRIGGERED' | 'WAIT_FOR_SEPARATION';

export interface GestureConfig {
  triggerThreshold?: number;  // Default: 0.045
  releaseThreshold?: number;  // Default: 0.080
  consecutiveFramesRequired?: number; // Default: 3
}

export class GestureController {
  private state: GestureState = 'READY';
  private triggerThreshold: number;
  private releaseThreshold: number;
  private consecutiveFramesRequired: number;
  private frameCounter: number = 0;

  private onGestureTriggeredCallback?: () => void;

  constructor(config: GestureConfig = {}) {
    this.triggerThreshold = config.triggerThreshold ?? 0.045;
    this.releaseThreshold = config.releaseThreshold ?? 0.080;
    this.consecutiveFramesRequired = config.consecutiveFramesRequired ?? 3;
  }

  public setOnGestureTriggered(callback: () => void): void {
    this.onGestureTriggeredCallback = callback;
  }

  public getState(): GestureState {
    return this.state;
  }

  /**
   * Processes normalized 4-point landmarks per frame.
   */
  public processFrame(points: { P1: Point2D; P2: Point2D; P3: Point2D; P4: Point2D } | null): {
    state: GestureState;
    distanceNorm: number;
    triggeredThisFrame: boolean;
  } {
    if (!points) {
      // Reset counter on tracking loss
      this.frameCounter = 0;
      return { state: this.state, distanceNorm: 1.0, triggeredThisFrame: false };
    }

    const { P1, P2, P3, P4 } = points;
    const pts = [P1, P2, P3, P4];

    // Compute maximum pairwise distance across all 6 pairs
    let maxDistSq = 0;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x;
        const dy = pts[i].y - pts[j].y;
        const distSq = dx * dx + dy * dy;
        if (distSq > maxDistSq) {
          maxDistSq = distSq;
        }
      }
    }

    const maxDistNorm = Math.sqrt(maxDistSq);
    let triggeredThisFrame = false;

    switch (this.state) {
      case 'READY':
        if (maxDistNorm < this.triggerThreshold) {
          this.frameCounter++;
          if (this.frameCounter >= this.consecutiveFramesRequired) {
            this.state = 'TRIGGERED';
            triggeredThisFrame = true;
            if (this.onGestureTriggeredCallback) {
              this.onGestureTriggeredCallback();
            }
            this.state = 'WAIT_FOR_SEPARATION';
            this.frameCounter = 0;
          }
        } else {
          this.frameCounter = 0;
        }
        break;

      case 'WAIT_FOR_SEPARATION':
        if (maxDistNorm > this.releaseThreshold) {
          this.state = 'READY';
          this.frameCounter = 0;
        }
        break;

      case 'TRIGGERED':
        this.state = 'WAIT_FOR_SEPARATION';
        break;
    }

    return {
      state: this.state,
      distanceNorm: maxDistNorm,
      triggeredThisFrame,
    };
  }

  public reset(): void {
    this.state = 'READY';
    this.frameCounter = 0;
  }
}
