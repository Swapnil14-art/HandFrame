import { Point2D } from '../camera/CoordinateTransformer';

export type GestureState = 'READY' | 'APPROACHING' | 'TRIGGERED' | 'WAITING_FOR_SEPARATION';

export interface GestureConfig {
  triggerThreshold?: number; // Default: 0.055
  releaseThreshold?: number; // Default: 0.110
  consecutiveFramesRequired?: number; // Default: 3
  cooldownMs?: number; // Default: 500ms
}

export class GestureController {
  private state: GestureState = 'READY';
  private triggerThreshold: number;
  private releaseThreshold: number;
  private consecutiveFramesRequired: number;
  private cooldownMs: number;

  private frameCounter: number = 0;
  private lastTriggerTime: number = 0;

  private onGestureTriggeredCallback?: () => void;

  constructor(config: GestureConfig = {}) {
    this.triggerThreshold = config.triggerThreshold ?? 0.055;
    this.releaseThreshold = config.releaseThreshold ?? 0.110;
    this.consecutiveFramesRequired = config.consecutiveFramesRequired ?? 3;
    this.cooldownMs = config.cooldownMs ?? 500;
  }

  public setOnGestureTriggered(callback: () => void): void {
    this.onGestureTriggeredCallback = callback;
  }

  public getState(): GestureState {
    return this.state;
  }

  /**
   * Processes normalized 4-point landmarks per frame.
   * Uses scale-independent centroid convergence metric requiring ALL 4 fingertips.
   */
  public processFrame(
    points: { P1: Point2D; P2: Point2D; P3: Point2D; P4: Point2D } | null,
    timestampNow: number = performance.now()
  ): {
    state: GestureState;
    distanceNorm: number;
    triggeredThisFrame: boolean;
  } {
    if (!points) {
      // Reset approaching counter on tracking loss
      this.frameCounter = 0;
      return { state: this.state, distanceNorm: 1.0, triggeredThisFrame: false };
    }

    const { P1, P2, P3, P4 } = points;
    const pts = [P1, P2, P3, P4];

    // 1. Calculate centroid C of all 4 fingertips
    const cx = (P1.x + P2.x + P3.x + P4.x) / 4;
    const cy = (P1.y + P2.y + P3.y + P4.y) / 4;

    // 2. Compute maximum distance from any of the 4 fingertips to Centroid C
    // This ensures ALL 4 fingertips MUST converge together!
    let maxDistToCentroidSq = 0;
    for (const pt of pts) {
      const dx = pt.x - cx;
      const dy = pt.y - cy;
      const distSq = dx * dx + dy * dy;
      if (distSq > maxDistToCentroidSq) {
        maxDistToCentroidSq = distSq;
      }
    }

    const maxDistNorm = Math.sqrt(maxDistToCentroidSq);
    let triggeredThisFrame = false;

    const timeSinceLastTrigger = timestampNow - this.lastTriggerTime;
    const isCooldownActive = timeSinceLastTrigger < this.cooldownMs;

    // State Machine Transitions
    switch (this.state) {
      case 'READY':
        if (maxDistNorm < this.triggerThreshold && !isCooldownActive) {
          this.state = 'APPROACHING';
          this.frameCounter = 1;
        } else {
          this.frameCounter = 0;
        }
        break;

      case 'APPROACHING':
        if (maxDistNorm < this.triggerThreshold && !isCooldownActive) {
          this.frameCounter++;
          if (this.frameCounter >= this.consecutiveFramesRequired) {
            // TRIGGER EXACTLY ONCE
            this.state = 'TRIGGERED';
            triggeredThisFrame = true;
            this.lastTriggerTime = timestampNow;

            if (this.onGestureTriggeredCallback) {
              this.onGestureTriggeredCallback();
            }

            // Immediately transition to WAITING_FOR_SEPARATION
            this.state = 'WAITING_FOR_SEPARATION';
            this.frameCounter = 0;
          }
        } else {
          // Boundary lost before required frames
          this.state = 'READY';
          this.frameCounter = 0;
        }
        break;

      case 'WAITING_FOR_SEPARATION':
        // Require fingers to separate beyond releaseThreshold AND cooldown to pass
        if (maxDistNorm > this.releaseThreshold && !isCooldownActive) {
          this.state = 'READY';
          this.frameCounter = 0;
        }
        break;

      case 'TRIGGERED':
        // Defensive transition
        this.state = 'WAITING_FOR_SEPARATION';
        this.frameCounter = 0;
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
    this.lastTriggerTime = 0;
  }
}
