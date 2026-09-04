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
   */
  public async startCamera(
    videoElement: HTMLVideoElement,
    preferredFacingMode: 'user' | 'environment' = 'user'
  ): Promise<MediaStream> {
    this.videoElement = videoElement;
    this.currentFacingMode = preferredFacingMode;

    // Stop existing stream if active
    this.stopCamera();

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        facingMode: preferredFacingMode,
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 60, min: 30 },
      },
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.currentStream = stream;
      videoElement.srcObject = stream;

      // Extract device ID
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        if (settings.deviceId) {
          this.currentDeviceId = settings.deviceId;
        }
      }

      await videoElement.play();
      return stream;
    } catch (err) {
      console.error('Error starting camera:', err);
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
