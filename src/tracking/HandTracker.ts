import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { Point2D } from '../camera/CoordinateTransformer';

export type TrackingStatus =
  | 'NO_HANDS'
  | 'ONE_HAND'
  | 'TWO_HANDS'
  | 'TRACKING_STABLE'
  | 'TRACKING_DEGRADED';

export interface HandFramePoints {
  P1: Point2D; // Left Index Tip
  P2: Point2D; // Right Index Tip
  P3: Point2D; // Right Thumb Tip
  P4: Point2D; // Left Thumb Tip
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
  private readonly maxGraceFrames: number = 10; // ~300ms grace period at 30fps

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
        minHandDetectionConfidence: 0.45,
        minHandPresenceConfidence: 0.45,
        minTrackingConfidence: 0.45,
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
          minHandDetectionConfidence: 0.4,
          minHandPresenceConfidence: 0.4,
          minTrackingConfidence: 0.4,
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
   * Employs temporal grace period, outlier rejection, and robust handedness mapping.
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
        // TEMPORAL GRACE PERIOD: If 2 hands are briefly lost, retain last valid points
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

      // We have 2 hands detected in this frame
      const hand0 = results.landmarks[0]; // 21 landmarks each
      const hand1 = results.landmarks[1];

      const handedness0 = results.handednesses?.[0]?.[0]?.categoryName; // 'Left' or 'Right'
      const handedness1 = results.handednesses?.[1]?.[0]?.categoryName;

      // Calculate wrist X coordinates for spatial sorting (Landmark 0 = WRIST)
      const x0 = hand0[0].x;
      const x1 = hand1[0].x;

      let leftHandLandmarks = hand0;
      let rightHandLandmarks = hand1;

      // Determine left vs right hand based on combined handedness & horizontal position
      // In camera coordinates, x goes 0 -> 1 (left to right).
      // If mirrored (front camera), screen-left is x=0 in raw space.
      if (handedness0 === 'Left' && handedness1 === 'Right') {
        leftHandLandmarks = hand0;
        rightHandLandmarks = hand1;
      } else if (handedness0 === 'Right' && handedness1 === 'Left') {
        leftHandLandmarks = hand1;
        rightHandLandmarks = hand0;
      } else {
        // Fallback: spatial sorting by wrist X coordinate
        if (x0 < x1) {
          leftHandLandmarks = hand0;
          rightHandLandmarks = hand1;
        } else {
          leftHandLandmarks = hand1;
          rightHandLandmarks = hand0;
        }
      }

      // Landmark ID 8 = INDEX_FINGER_TIP, Landmark ID 4 = THUMB_TIP
      let rawP1 = { x: leftHandLandmarks[8].x, y: leftHandLandmarks[8].y }; // Left Index
      let rawP4 = { x: leftHandLandmarks[4].x, y: leftHandLandmarks[4].y }; // Left Thumb
      let rawP2 = { x: rightHandLandmarks[8].x, y: rightHandLandmarks[8].y }; // Right Index
      let rawP3 = { x: rightHandLandmarks[4].x, y: rightHandLandmarks[4].y }; // Right Thumb

      // Outlier Rejection: Damp unphysically large single-frame jumps (>0.35 norm units)
      if (this.lastValidPoints) {
        rawP1 = this.clampOutlier(rawP1, this.lastValidPoints.P1, 0.35);
        rawP2 = this.clampOutlier(rawP2, this.lastValidPoints.P2, 0.35);
        rawP3 = this.clampOutlier(rawP3, this.lastValidPoints.P3, 0.35);
        rawP4 = this.clampOutlier(rawP4, this.lastValidPoints.P4, 0.35);
      }

      const score0 = results.handednesses?.[0]?.[0]?.score || 0.85;
      const score1 = results.handednesses?.[1]?.[0]?.score || 0.85;
      const confidence = (score0 + score1) / 2;

      const currentPoints: HandFramePoints = {
        P1: rawP1,
        P2: rawP2,
        P3: rawP3,
        P4: rawP4,
        confidence,
        status: 'TRACKING_STABLE',
        isGraceFrame: false,
      };

      // Reset grace counter & save last valid points
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
   * Prevents impossible single-frame teleports (outlier rejection).
   */
  private clampOutlier(candidate: Point2D, previous: Point2D, maxJumpNorm: number): Point2D {
    const dx = candidate.x - previous.x;
    const dy = candidate.y - previous.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > maxJumpNorm) {
      // Clamp jump to max allowed speed
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
