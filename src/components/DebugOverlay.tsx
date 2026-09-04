import React from 'react';
import { GestureState } from '../gesture/GestureController';

export interface DebugData {
  fps: number;
  latencyMs: number;
  gestureState: GestureState;
  distanceNorm: number;
  confidence: number;
  activeFilterName: string;
  hasQuad: boolean;
  videoWidth: number;
  videoHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}

interface DebugOverlayProps {
  data: DebugData;
  onClose: () => void;
}

export const DebugOverlay: React.FC<DebugOverlayProps> = ({ data, onClose }) => {
  return (
    <div className="fixed bottom-20 left-4 z-40 bg-black/80 backdrop-blur-md text-emerald-400 font-mono text-[11px] p-4 rounded-xl border border-emerald-500/20 shadow-2xl space-y-1.5 w-72 pointer-events-auto">
      <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1.5 mb-2 text-white font-semibold">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          Dev Debug Overlay
        </span>
        <button
          onClick={onClose}
          className="text-white/60 hover:text-white text-xs px-1 hover:bg-white/10 rounded"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
        <div>
          <span className="text-white/50">FPS:</span> {data.fps}
        </div>
        <div>
          <span className="text-white/50">Latency:</span> {data.latencyMs}ms
        </div>
        <div>
          <span className="text-white/50">Filter:</span> {data.activeFilterName}
        </div>
        <div>
          <span className="text-white/50">Quad Active:</span> {data.hasQuad ? 'YES' : 'NO'}
        </div>
        <div>
          <span className="text-white/50">Gesture:</span> {data.gestureState}
        </div>
        <div>
          <span className="text-white/50">Pinch Dist:</span> {data.distanceNorm.toFixed(4)}
        </div>
        <div>
          <span className="text-white/50">Stream Res:</span> {data.videoWidth}x{data.videoHeight}
        </div>
        <div>
          <span className="text-white/50">Canvas:</span> {data.canvasWidth}x{data.canvasHeight}
        </div>
      </div>

      <div className="text-[10px] text-white/40 pt-1 border-t border-emerald-500/20">
        Press <kbd className="bg-white/10 px-1 rounded text-white/80">D</kbd> to toggle debug mode
      </div>
    </div>
  );
};
