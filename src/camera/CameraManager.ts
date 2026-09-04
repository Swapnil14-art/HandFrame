export interface CameraDevice {
  deviceId: string;
  label: string;
  facingMode?: 'user' | 'environment';
}

export class CameraManager {
  private currentStream: MediaStream | null = null;
  private currentDeviceId: string | null = null;
  private currentFacingMode: 'user' | 'environment' = 'user';
  private videoElement: HTMLVideoElement | null = null;

  /**
   * Initializes camera stream on target HTML5 video element.
   * Implements progressive fallback constraints to ensure compatibility across mobile devices & desktop browsers.
   */
  public async startCamera(
    videoElement: HTMLVideoElement,
    preferredFacingMode: 'user' | 'environment' = 'user'
  ): Promise<MediaStream> {
    this.videoElement = videoElement;
    this.currentFacingMode = preferredFacingMode;

    // Ensure required iOS Safari attributes are set on HTMLVideoElement
    videoElement.setAttribute('playsinline', 'true');
    videoElement.setAttribute('muted', 'true');
    videoElement.setAttribute('autoplay', 'true');
    videoElement.playsInline = true;
    videoElement.muted = true;

    // Stop existing stream if active
    this.stopCamera();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        'SECURITY_CONTEXT_REQUIRED: Camera access requires HTTPS or localhost. navigator.mediaDevices is unavailable in plain HTTP on mobile browsers.'
      );
    }

    // Progressive Constraint Levels to prevent OverconstrainedError on Mobile
    const constraintLevels: MediaStreamConstraints[] = [
      // Level 1: Mobile-optimized ideal resolution & facing mode
      {
        audio: false,
        video: {
          facingMode: { ideal: preferredFacingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      },
      // Level 2: Simple facing mode constraint
      {
        audio: false,
        video: {
          facingMode: preferredFacingMode,
        },
      },
      // Level 3: Basic video stream fallback
      {
        audio: false,
        video: true,
      },
    ];

    let lastError: any = null;
    let stream: MediaStream | null = null;

    for (const constraints of constraintLevels) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stream) break;
      } catch (err) {
        console.warn('getUserMedia failed with constraint level, trying fallback:', constraints, err);
        lastError = err;
      }
    }

    if (!stream) {
      throw lastError || new Error('Unable to access camera device with any supported constraints.');
    }

    try {
      this.currentStream = stream;
      videoElement.srcObject = stream;

      // Extract device ID if available
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        if (settings.deviceId) {
          this.currentDeviceId = settings.deviceId;
        }
      }

      // Explicit play invocation with promise catch for mobile autoplay policies
      try {
        await videoElement.play();
      } catch (playErr) {
        console.warn('videoElement.play() promise rejected:', playErr);
      }

      return stream;
    } catch (err) {
      console.error('Error attaching stream to video element:', err);
      throw err;
    }
  }

  /**
   * Switches facing mode between user (front) and environment (rear).
   */
  public async switchCamera(videoElement: HTMLVideoElement): Promise<MediaStream> {
    const nextFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
    return this.startCamera(videoElement, nextFacingMode);
  }

  /**
   * Enumerates available video input devices.
   */
  public async getCameraDevices(): Promise<CameraDevice[]> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return [];
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === 'videoinput')
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${idx + 1}`,
        }));
    } catch (err) {
      console.warn('Failed to enumerate devices:', err);
      return [];
    }
  }

  /**
   * Gets current facing mode ('user' or 'environment').
   */
  public getFacingMode(): 'user' | 'environment' {
    return this.currentFacingMode;
  }

  /**
   * Checks if current camera stream is mirrored (front camera).
   */
  public isMirrored(): boolean {
    return this.currentFacingMode === 'user';
  }

  /**
   * Stops active camera tracks and detaches video element srcObject.
   */
  public stopCamera(): void {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach((track) => track.stop());
      this.currentStream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }
}
