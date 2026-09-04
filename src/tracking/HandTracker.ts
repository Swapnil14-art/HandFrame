import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { Point2D } from '../camera/CoordinateTransformer';

export type TrackingStatus =
  | 'NO_HANDS'
  | 'ONE_HAND'
  | 'TWO_HANDS'
  | 'TRACKING_STABLE'
  | 'TRACKING_DEGRADED';

export interface HandFramePoints {
  P1: Point2D; // Vertex 1 (Top-Left / Counter-clockwise)
  P2: Point2D; // Vertex 2 (Top-Right)
  P3: Point2D; // Vertex 3 (Bottom-Right)
  P4: Point2D; // Vertex 4 (Bottom-Left)
  confidence: number;
  status: TrackingStatus;
  isGraceFrame?: boolean;
}

export class HandTracker {
  private handLandmarker: HandLandmarker | null = null;
  private isInitializing: boolean = false;
  private isReady: boolean = false;

  // Temporal persistence & grace period state
  private lastValidPoints: HandFramePoints | null = null;
  private graceFramesCount: number = 0;
  private readonly maxGraceFrames: number = 12; // ~350ms grace period at 30fps

  /**
   * Initializes MediaPipe HandLandmarker WASM instance.
   */
  public async initialize(): Promise<void> {
    if (this.isReady || this.isInitializing) return;
    this.isInitializing = true;

    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.4,
        minHandPresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      });

      this.isReady = true;
      this.isInitializing = false;
    } catch (err) {
      console.warn('GPU delegate failed for HandLandmarker, attempting CPU fallback:', err);
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.35,
          minHandPresenceConfidence: 0.35,
          minTrackingConfidence: 0.35,
        });

        this.isReady = true;
        this.isInitializing = false;
      } catch (fallbackErr) {
        this.isInitializing = false;
        console.error('Fatal: Failed to initialize HandLandmarker:', fallbackErr);
        throw fallbackErr;
      }
    }
  }

  public getIsReady(): boolean {
    return this.isReady;
  }

  /**
   * Detects hands in video frame and extracts 4 key fingertip landmarks.
   * Completely orientation-agnostic (supports 180° rotation, upside-down hands, thumb-below-index).
   */
  public detect(
    videoElement: HTMLVideoElement,
    timestamp: number,
    isMirrored: boolean = false
  ): HandFramePoints | null {
    if (!this.handLandmarker || !this.isReady) return null;
    if (videoElement.readyState < 2) return null;

    try {
      const results = this.handLandmarker.detectForVideo(videoElement, timestamp);

      const hasTwoHands = results && results.landmarks && results.landmarks.length >= 2;

      if (!hasTwoHands) {
        // TEMPORAL GRACE PERIOD: Retain last valid points during temporary 1-frame tracking drops
        if (this.lastValidPoints && this.graceFramesCount < this.maxGraceFrames) {
          this.graceFramesCount++;
          return {
            ...this.lastValidPoints,
            status: 'TRACKING_DEGRADED',
            isGraceFrame: true,
          };
        }

        // Grace period expired
        this.lastValidPoints = null;
        this.graceFramesCount = 0;
        return null;
      }

      // 1. Extract raw 4 fingertips (MediaPipe Landmark 8 = Index Tip, Landmark 4 = Thumb Tip)
      const hand0 = results.landmarks[0];
      const hand1 = results.landmarks[1];

      const candidatePoints: Point2D[] = [
        { x: hand0[8].x, y: hand0[8].y }, // Hand 0 Index
        { x: hand0[4].x, y: hand0[4].y }, // Hand 0 Thumb
        { x: hand1[8].x, y: hand1[8].y }, // Hand 1 Index
        { x: hand1[4].x, y: hand1[4].y }, // Hand 1 Thumb
      ];

      // Confidence computation
      const score0 = results.handednesses?.[0]?.[0]?.score || 0.85;
      const score1 = results.handednesses?.[1]?.[0]?.score || 0.85;
      const confidence = (score0 + score1) / 2;

      let orderedPoints: [Point2D, Point2D, Point2D, Point2D];

      // 2. Track points across time using Optimal Distance Bipartite Matching
      if (this.lastValidPoints) {
        const prevPts = [
          this.lastValidPoints.P1,
          this.lastValidPoints.P2,
          this.lastValidPoints.P3,
          this.lastValidPoints.P4,
        ];
        orderedPoints = this.matchCandidatesToPrevious(candidatePoints, prevPts);
      } else {
        // First frame: Order points around centroid in perimeter order
        orderedPoints = this.orderPointsConvex(candidatePoints);
      }

      // 3. Outlier Rejection: Clamp unphysically large single-frame teleports (>0.35 norm units)
      if (this.lastValidPoints) {
        orderedPoints[0] = this.clampOutlier(orderedPoints[0], this.lastValidPoints.P1, 0.35);
        orderedPoints[1] = this.clampOutlier(orderedPoints[1], this.lastValidPoints.P2, 0.35);
        orderedPoints[2] = this.clampOutlier(orderedPoints[2], this.lastValidPoints.P3, 0.35);
        orderedPoints[3] = this.clampOutlier(orderedPoints[3], this.lastValidPoints.P4, 0.35);
      }

      const currentPoints: HandFramePoints = {
        P1: orderedPoints[0],
        P2: orderedPoints[1],
        P3: orderedPoints[2],
        P4: orderedPoints[3],
        confidence,
        status: 'TRACKING_STABLE',
        isGraceFrame: false,
      };

      this.graceFramesCount = 0;
      this.lastValidPoints = currentPoints;

      return currentPoints;
    } catch (err) {
      console.warn('Error during hand detection frame:', err);
      if (this.lastValidPoints && this.graceFramesCount < this.maxGraceFrames) {
        this.graceFramesCount++;
        return {
          ...this.lastValidPoints,
          status: 'TRACKING_DEGRADED',
          isGraceFrame: true,
        };
      }
      return null;
    }
  }

  /**
   * Optimal 1-to-1 bipartite matching between new candidate points and previous frame points.
   * Prevents point-swapping when hands rotate 180°, cross, or flip orientation.
   */
  private matchCandidatesToPrevious(
    candidates: Point2D[],
    previous: Point2D[]
  ): [Point2D, Point2D, Point2D, Point2D] {
    // Generate all 24 permutations of 4 elements
    const permutations = this.getPermutations([0, 1, 2, 3]);

    let minTotalDistSq = Infinity;
    let bestPermutation = permutations[0];

    for (const perm of permutations) {
      let totalDistSq = 0;
      for (let i = 0; i < 4; i++) {
        const cand = candidates[perm[i]];
        const prev = previous[i];
        const dx = cand.x - prev.x;
        const dy = cand.y - prev.y;
        totalDistSq += dx * dx + dy * dy;
      }

      if (totalDistSq < minTotalDistSq) {
        minTotalDistSq = totalDistSq;
        bestPermutation = perm;
      }
    }

    return [
      candidates[bestPermutation[0]],
      candidates[bestPermutation[1]],
      candidates[bestPermutation[2]],
      candidates[bestPermutation[3]],
    ];
  }

  /**
   * Sorts 4 points by polar angle around their centroid to form a clean, non-self-intersecting perimeter loop.
   */
  private orderPointsConvex(points: Point2D[]): [Point2D, Point2D, Point2D, Point2D] {
    const cx = (points[0].x + points[1].x + points[2].x + points[3].x) / 4;
    const cy = (points[0].y + points[1].y + points[2].y + points[3].y) / 4;

    const sorted = [...points].sort((a, b) => {
      const angleA = Math.atan2(a.y - cy, a.x - cx);
      const angleB = Math.atan2(b.y - cy, b.x - cx);
      return angleA - angleB;
    });

    return [sorted[0], sorted[1], sorted[2], sorted[3]];
  }

  private getPermutations(arr: number[]): number[][] {
    if (arr.length <= 1) return [arr];
    const result: number[][] = [];
    for (let i = 0; i < arr.length; i++) {
      const current = arr[i];
      const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
      const remainingPerms = this.getPermutations(remaining);
      for (const perm of remainingPerms) {
        result.push([current, ...perm]);
      }
    }
    return result;
  }

  private clampOutlier(candidate: Point2D, previous: Point2D, maxJumpNorm: number): Point2D {
    const dx = candidate.x - previous.x;
    const dy = candidate.y - previous.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > maxJumpNorm) {
      const scale = maxJumpNorm / dist;
      return {
        x: previous.x + dx * scale,
        y: previous.y + dy * scale,
      };
    }
    return candidate;
  }

  public resetHistory(): void {
    this.lastValidPoints = null;
    this.graceFramesCount = 0;
  }

  public close(): void {
    if (this.handLandmarker) {
      this.handLandmarker.close();
      this.handLandmarker = null;
      this.isReady = false;
      this.resetHistory();
    }
  }
}
