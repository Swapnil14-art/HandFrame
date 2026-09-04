import React from 'react';
import { Camera, ShieldCheck, Sparkles, Move } from 'lucide-react';

interface LandingPageProps {
  onStartCamera: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStartCamera }) => {
  return (
    <div className="relative w-screen h-dvh bg-black text-white flex flex-col justify-between p-6 md:p-12 overflow-hidden select-none">
      {/* Background Subtle Gradient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-zinc-800/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Bar Header */}
      <header className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
          <span className="font-mono text-xs tracking-[0.25em] uppercase text-white/90 font-semibold">
            HANDFRAME
          </span>
        </div>
        <span className="text-[11px] font-mono text-white/40 border border-white/10 px-2.5 py-1 rounded-full">
          v6.0 WEB
        </span>
      </header>

      {/* Hero Content */}
      <main className="relative z-10 max-w-2xl mx-auto text-center my-auto py-12 flex flex-col items-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 text-xs font-mono mb-8 backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-white/80" />
          Local-First Browser Camera Experience
        </div>

        <h1 className="text-4xl md:text-6xl font-light tracking-tight text-white mb-6 leading-tight">
          Create the frame. <br />
          <span className="font-semibold text-white/90">Change what happens inside it.</span>
        </h1>

        <p className="text-white/60 text-sm md:text-base max-w-lg mb-10 leading-relaxed font-light">
          Track four physical fingertips to construct a dynamic, real-time visual quadrilateral camera frame with atmospheric image filters.
        </p>

        {/* Primary Action Button */}
        <button
          onClick={onStartCamera}
          className="group relative inline-flex items-center gap-3 px-8 py-4 bg-white text-black font-semibold text-sm rounded-full shadow-2xl hover:bg-white/90 active:scale-95 transition-all duration-200"
        >
          <Camera className="w-4 h-4 text-black group-hover:scale-110 transition-transform" />
          <span>Start HandFrame</span>
        </button>
      </main>

      {/* Footer Features */}
      <footer className="relative z-10 border-t border-white/10 pt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-center md:text-left max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-center md:justify-start gap-3">
          <ShieldCheck className="w-4 h-4 text-white/50 shrink-0" />
          <div>
            <h3 className="text-xs font-medium text-white/80">100% Private & Local</h3>
            <p className="text-[11px] text-white/40">Camera stream never leaves your device browser</p>
          </div>
        </div>

        <div className="flex items-center justify-center md:justify-start gap-3">
          <Move className="w-4 h-4 text-white/50 shrink-0" />
          <div>
            <h3 className="text-xs font-medium text-white/80">4-Point Gesture Tracking</h3>
            <p className="text-[11px] text-white/40">Dynamic quadrilateral follows your natural hand motion</p>
          </div>
        </div>

        <div className="flex items-center justify-center md:justify-start gap-3">
          <Sparkles className="w-4 h-4 text-white/50 shrink-0" />
          <div>
            <h3 className="text-xs font-medium text-white/80">Proximity Filter Cycle</h3>
            <p className="text-[11px] text-white/40">Bring 4 fingertips together to advance filters</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
