import React, { useEffect, useRef, useState } from 'react';
import { CameraManager } from '../camera/CameraManager';
import { CoordinateTransformer } from '../camera/CoordinateTransformer';
import { HandTracker } from '../tracking/HandTracker';
import { QuadGeometry, QuadPolygon } from '../geometry/QuadGeometry';
import { GestureController } from '../gesture/GestureController';
import { QuadCompositor } from '../compositing/QuadCompositor';
import { FilterSessionStore } from '../store/FilterSessionStore';
import { ToastNotification } from './ToastNotification';
import { DebugOverlay, DebugData } from './DebugOverlay';
import {
  ArrowLeft,
  Maximize,
  Minimize,
  RefreshCw,
  Bug,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

interface CameraViewProps {
  onBackToLanding: () => void;
}

export const CameraView: React.FC<CameraViewProps> = ({ onBackToLanding }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('Initializing HandFrame Engine...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [debugData, setDebugData] = useState<DebugData>({
    fps: 0,
    latencyMs: 0,
    gestureState: 'READY',
    distanceNorm: 1,
    confidence: 0,
    activeFilterName: 'Original',
    hasQuad: false,
    videoWidth: 0,
    videoHeight: 0,
    canvasWidth: 0,
    canvasHeight: 0,
  });

  const [activeFilterName, setActiveFilterName] = useState('Original');

  // Core managers refs (persisted across RAF loop without triggering React renders)
  const cameraManagerRef = useRef<CameraManager>(new CameraManager());
  const handTrackerRef = useRef<HandTracker>(new HandTracker());
  const gestureControllerRef = useRef<GestureController>(new GestureController());
  const compositorRef = useRef<QuadCompositor | null>(null);
  const sessionStoreRef = useRef<FilterSessionStore>(FilterSessionStore.getInstance());

  const animationFrameIdRef = useRef<number | null>(null);
  const lastQuadRef = useRef<QuadPolygon | null>(null);

  // Performance metrics tracking
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());
  const currentFpsRef = useRef(0);

  useEffect(() => {
    let isMounted = true;

    const sessionStore = sessionStoreRef.current;
    setActiveFilterName(sessionStore.getCurrentFilter().displayName);

    // Subscribe to store filter changes
    const unsubscribeStore = sessionStore.subscribe(() => {
      const current = sessionStore.getCurrentFilter();
      setActiveFilterName(current.displayName);
    });

    const initEngine = async () => {
      try {
        if (!videoRef.current || !canvasRef.current) return;
        setErrorMessage(null);
        setIsLoading(true);

        // 1. Initialize Compositor
        compositorRef.current = new QuadCompositor();

        // 2. Start Camera with mobile fallbacks & iOS Safari attributes
        setLoadingText('Requesting Mobile Camera Stream...');
        await cameraManagerRef.current.startCamera(videoRef.current, 'user');
        if (!isMounted) return;

        // 3. Initialize MediaPipe Hand Tracker WASM
        setLoadingText('Loading Local Hand Landmarker WASM...');
        await handTrackerRef.current.initialize();
        if (!isMounted) return;

        // 4. Setup Gesture trigger callback
        gestureControllerRef.current.setOnGestureTriggered(() => {
          const next = sessionStore.nextFilter();
          setToastMessage(next.displayName);
        });

        setIsLoading(false);

        // 5. Start main requestAnimationFrame loop
        startRenderLoop();
      } catch (err: any) {
        console.error('HandFrame engine initialization error:', err);
        if (isMounted) {
          setIsLoading(false);
          if (err?.message?.includes('SECURITY_CONTEXT_REQUIRED')) {
            setErrorMessage(
              'Camera access requires HTTPS or localhost on mobile browsers. Mobile Safari and Chrome block WebRTC camera access over HTTP IP addresses.'
            );
          } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setErrorMessage('Camera access was denied. Please allow camera permissions in your mobile browser settings to use HandFrame.');
          } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            setErrorMessage('No camera hardware was detected on your device.');
          } else {
            setErrorMessage('Failed to initialize mobile camera. Please ensure camera permissions are granted and retry.');
          }
        }
      }
    };

    initEngine();

    // Keyboard shortcut handler for Debug mode (D key) & Fullscreen (F key)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') {
        setIsDebugOpen((prev) => !prev);
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      isMounted = false;
      window.removeEventListener('keydown', handleKeyDown);
      unsubscribeStore();

      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }

      cameraManagerRef.current.stopCamera();
      handTrackerRef.current.close();
    };
  }, []);

  const startRenderLoop = () => {
    const loop = (timestamp: number) => {
      const startTime = performance.now();

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const tracker = handTrackerRef.current;
      const compositor = compositorRef.current;
      const sessionStore = sessionStoreRef.current;

      if (video && canvas && tracker && compositor && video.readyState >= 2) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          // Resize canvas to match displayed window/element bounds
          const displayWidth = canvas.clientWidth || window.innerWidth;
          const displayHeight = canvas.clientHeight || window.innerHeight;

          if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
          }

          const isMirrored = cameraManagerRef.current.isMirrored();

          // 1. Detect Hand Landmarks
          const landmarksResult = tracker.detect(video, timestamp, isMirrored);

          let quad: QuadPolygon | null = null;
          if (landmarksResult) {
            const transformConfig = {
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              canvasWidth: canvas.width,
              canvasHeight: canvas.height,
              isMirrored,
              objectFit: 'cover' as const,
            };

            // Map MediaPipe normalized (0..1) coordinates to canvas pixels
            const rawQuad: QuadPolygon = {
              P1: CoordinateTransformer.normalizedToCanvasPoint(landmarksResult.P1, transformConfig),
              P2: CoordinateTransformer.normalizedToCanvasPoint(landmarksResult.P2, transformConfig),
              P3: CoordinateTransformer.normalizedToCanvasPoint(landmarksResult.P3, transformConfig),
              P4: CoordinateTransformer.normalizedToCanvasPoint(landmarksResult.P4, transformConfig),
            };

            quad = QuadGeometry.smoothQuad(rawQuad, lastQuadRef.current);
            lastQuadRef.current = quad;
          } else {
            lastQuadRef.current = null;
          }

          // 2. Process Gesture State Machine
          const gestureResult = gestureControllerRef.current.processFrame(
            landmarksResult
              ? {
                  P1: landmarksResult.P1,
                  P2: landmarksResult.P2,
                  P3: landmarksResult.P3,
                  P4: landmarksResult.P4,
                }
              : null,
            startTime
          );

          // 3. Render Canvas & Apply Regional Filter
          const currentFilter = sessionStore.getCurrentFilter();
          compositor.renderFrame(ctx, video, canvas.width, canvas.height, quad, currentFilter, isMirrored);

          // 4. Update FPS & Latency metrics
          frameCountRef.current++;
          const now = performance.now();
          if (now - lastFpsTimeRef.current >= 1000) {
            currentFpsRef.current = Math.round((frameCountRef.current * 1000) / (now - lastFpsTimeRef.current));
            frameCountRef.current = 0;
            lastFpsTimeRef.current = now;
          }

          const latencyMs = Math.round(performance.now() - startTime);

          // Update debug state periodically if debug panel is open
          if (isDebugOpen && Math.random() < 0.1) {
            setDebugData({
              fps: currentFpsRef.current,
              latencyMs,
              gestureState: gestureResult.state,
              distanceNorm: gestureResult.distanceNorm,
              confidence: landmarksResult?.confidence || 0,
              activeFilterName: currentFilter.displayName,
              hasQuad: quad !== null,
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              canvasWidth: canvas.width,
              canvasHeight: canvas.height,
            });
          }
        }
      }

      animationFrameIdRef.current = requestAnimationFrame(loop);
    };

    animationFrameIdRef.current = requestAnimationFrame(loop);
  };

  const handleManualNextFilter = () => {
    const next = sessionStoreRef.current.nextFilter();
    setToastMessage(next.displayName);
  };

  const handleSwitchCamera = async () => {
    if (!videoRef.current) return;
    try {
      setIsLoading(true);
      setLoadingText('Switching Camera Source...');
      await cameraManagerRef.current.switchCamera(videoRef.current);
      setIsLoading(false);
    } catch (err) {
      console.warn('Failed to switch camera:', err);
      setIsLoading(false);
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
          setIsFullscreen(false);
        }
      }
    } catch (err) {
      console.warn('Fullscreen API error:', err);
    }
  };

  return (
    <div className="relative w-screen h-dvh bg-black overflow-hidden select-none">
      {/* Active WebRTC video element (rendered transparently for mobile video frame decoding) */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Main Fullscreen Output Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-lg flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-full border-2 border-white/20 border-t-white animate-spin mb-4" />
          <p className="text-white/90 text-sm font-medium tracking-wide">{loadingText}</p>
          <p className="text-white/40 text-xs mt-2">Processing 100% locally inside browser</p>
        </div>
      )}

      {/* Error Overlay */}
      {errorMessage && (
        <div className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="w-12 h-12 text-rose-500 mb-4 animate-bounce" />
          <h2 className="text-white text-lg font-semibold mb-2">Camera Access Issue</h2>
          <p className="text-white/70 text-xs max-w-sm mb-6 leading-relaxed">{errorMessage}</p>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-emerald-500 text-black text-xs font-semibold rounded-full hover:bg-emerald-400 transition-all"
            >
              Retry Camera
            </button>
            <button
              onClick={onBackToLanding}
              className="px-5 py-2.5 bg-white/10 text-white border border-white/20 text-xs font-semibold rounded-full hover:bg-white/20 transition-all"
            >
              Back to Landing
            </button>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      <ToastNotification message={toastMessage} onClear={() => setToastMessage(null)} />

      {/* Dev Debug Overlay */}
      {isDebugOpen && (
        <DebugOverlay data={debugData} onClose={() => setIsDebugOpen(false)} />
      )}

      {/* Floating Top Controls Overlay */}
      <div className="absolute top-0 inset-x-0 p-4 md:p-6 flex items-center justify-between z-30 pointer-events-none">
        {/* Top-Left: Exit Camera */}
        <button
          onClick={onBackToLanding}
          className="pointer-events-auto w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/80 hover:text-white hover:bg-black/60 flex items-center justify-center transition-all shadow-lg active:scale-95"
          title="Exit Camera"
          aria-label="Exit Camera"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Top-Right Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Switch Camera */}
          <button
            onClick={handleSwitchCamera}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/80 hover:text-white hover:bg-black/60 flex items-center justify-center transition-all shadow-lg active:scale-95"
            title="Switch Camera"
            aria-label="Switch Camera"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Toggle Fullscreen Mode */}
          <button
            onClick={toggleFullscreen}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/80 hover:text-white hover:bg-black/60 flex items-center justify-center transition-all shadow-lg active:scale-95"
            title="Toggle Fullscreen"
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>

          {/* Toggle Debug Overlay */}
          <button
            onClick={() => setIsDebugOpen((prev) => !prev)}
            className={`w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center transition-all shadow-lg active:scale-95 ${
              isDebugOpen ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/30' : 'text-white/80 hover:text-white hover:bg-black/60'
            }`}
            title="Toggle Debug Overlay (D)"
            aria-label="Toggle Debug Overlay"
          >
            <Bug className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Bottom-Center Filter Indicator Pill */}
      <div className="absolute bottom-6 inset-x-0 flex flex-col items-center justify-center z-30 pointer-events-none">
        <button
          onClick={handleManualNextFilter}
          className="pointer-events-auto group bg-black/50 backdrop-blur-md border border-white/15 px-5 py-2.5 rounded-full text-white/90 hover:text-white hover:bg-black/70 hover:border-white/30 transition-all shadow-2xl flex items-center gap-2.5 active:scale-95"
          title="Click to cycle next filter"
        >
          <Sparkles className="w-3.5 h-3.5 text-white/70 group-hover:text-white transition-colors" />
          <span className="text-xs font-mono tracking-wider uppercase">{activeFilterName}</span>
        </button>
        <span className="text-[10px] text-white/40 mt-2 tracking-wide font-light">
          Pinch 4 fingertips together to cycle filter
        </span>
      </div>
    </div>
  );
};
