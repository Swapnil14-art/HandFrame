import React, { useEffect, useState, useRef } from 'react';
import { FilterSessionStore } from '../store/FilterSessionStore';
import { BaseFilter } from '../filters/types/FilterTypes';
import {
  ArrowLeft,
  Check,
  X,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Camera,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';

interface UnlistedFilterEditorProps {
  onLaunchCamera: () => void;
  onGoHome: () => void;
}

export const UnlistedFilterEditor: React.FC<UnlistedFilterEditorProps> = ({
  onLaunchCamera,
  onGoHome,
}) => {
  const sessionStore = FilterSessionStore.getInstance();
  const [allBuiltInFilters, setAllBuiltInFilters] = useState<BaseFilter[]>([]);
  const [activeFilterIds, setActiveFilterIds] = useState<string[]>([]);
  const [sampleCanvasReady, setSampleCanvasReady] = useState(false);

  useEffect(() => {
    setAllBuiltInFilters(sessionStore.getAllBuiltInFilters());
    setActiveFilterIds(sessionStore.getActiveFilterIds());

    const unsubscribe = sessionStore.subscribe(() => {
      setActiveFilterIds(sessionStore.getActiveFilterIds());
    });

    return () => unsubscribe();
  }, []);

  const handleToggle = (id: string) => {
    sessionStore.toggleFilter(id);
  };

  const handleMoveUp = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    sessionStore.moveFilterUp(id);
  };

  const handleMoveDown = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    sessionStore.moveFilterDown(id);
  };

  const handleResetToDefaults = () => {
    sessionStore.resetToDefaults();
  };

  return (
    <div className="min-h-dvh bg-black text-white p-4 md:p-8 flex flex-col items-center select-none overflow-y-auto">
      {/* Container */}
      <div className="w-full max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onGoHome}
              className="w-9 h-9 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all"
              title="Return Home"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold tracking-wide">Temporary Filter Editor</h1>
                <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Unlisted Route
                </span>
              </div>
              <p className="text-xs text-white/40">Configure active gesture cycle for this browser session</p>
            </div>
          </div>

          <button
            onClick={onLaunchCamera}
            className="flex items-center gap-2 px-4 py-2 bg-white text-black text-xs font-semibold rounded-full hover:bg-white/90 active:scale-95 transition-all shadow-lg"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Launch Camera</span>
          </button>
        </header>

        {/* Temporary State Banner Callout */}
        <div className="bg-zinc-900/80 border border-amber-500/30 rounded-xl p-4 text-xs text-amber-200/90 flex gap-3 items-start backdrop-blur-md">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-300">Session-Only Temporary Configuration</p>
            <p className="text-amber-200/70 text-[11px] leading-relaxed">
              Modifications here affect only your current local browser session. Temporary changes live strictly in-memory and will <strong>automatically reset to defaults upon reloading or refreshing the page</strong>.
            </p>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <Layers className="w-4 h-4 text-white/40" />
            <span>
              <strong className="text-white">{activeFilterIds.length}</strong> of {allBuiltInFilters.length} Built-in Filters Active
            </span>
          </div>

          <button
            onClick={handleResetToDefaults}
            className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
        </div>

        {/* Filter List Grid */}
        <div className="space-y-2.5">
          {allBuiltInFilters.map((filter, index) => {
            const isActive = activeFilterIds.includes(filter.id);
            const activeIndex = activeFilterIds.indexOf(filter.id);

            return (
              <div
                key={filter.id}
                onClick={() => handleToggle(filter.id)}
                className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-zinc-900/90 border-white/20 shadow-md'
                    : 'bg-zinc-950/40 border-white/5 opacity-50 hover:opacity-80'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Status Toggle Button */}
                  <div
                    className={`w-6 h-6 rounded-md flex items-center justify-center text-xs transition-colors ${
                      isActive ? 'bg-white text-black font-bold' : 'bg-white/10 text-white/40'
                    }`}
                  >
                    {isActive ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{filter.displayName}</span>
                      <span className="text-[10px] font-mono text-white/40 bg-white/5 px-2 py-0.5 rounded">
                        {filter.category}
                      </span>
                    </div>
                    <p className="text-xs text-white/50 mt-0.5">{filter.description}</p>
                  </div>
                </div>

                {/* Reordering Controls (Only if active) */}
                {isActive && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-mono text-white/40 mr-2">#{activeIndex + 1}</span>
                    <button
                      onClick={(e) => handleMoveUp(filter.id, e)}
                      disabled={activeIndex === 0}
                      className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent"
                      title="Move Up in Cycle Order"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleMoveDown(filter.id, e)}
                      disabled={activeIndex === activeFilterIds.length - 1}
                      className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent"
                      title="Move Down in Cycle Order"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="text-center pt-4 border-t border-white/10 text-xs text-white/30">
          HandFrame Built-in Filter Registry Interface — Session Override Mode
        </div>
      </div>
    </div>
  );
};
