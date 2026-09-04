import React, { useEffect, useState } from 'react';
import { FilterSessionStore } from '../store/FilterSessionStore';
import { BaseFilter } from '../filters/types/FilterTypes';
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Camera,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
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
  const [allFilters, setAllFilters] = useState<BaseFilter[]>([]);
  const [activeFilterIds, setActiveFilterIds] = useState<string[]>([]);

  useEffect(() => {
    setAllFilters(sessionStore.getAllBuiltInFilters());
    setActiveFilterIds(sessionStore.getActiveFilterIds());

    const unsubscribe = sessionStore.subscribe(() => {
      setActiveFilterIds(sessionStore.getActiveFilterIds());
    });

    return () => unsubscribe();
  }, []);

  const activeFilters = activeFilterIds
    .map((id) => allFilters.find((f) => f.id === id))
    .filter((f): f is BaseFilter => f !== undefined);

  const availableFilters = allFilters.filter((f) => !activeFilterIds.includes(f.id));

  const handleAddFilter = (id: string) => {
    sessionStore.toggleFilter(id);
  };

  const handleRemoveFilter = (id: string) => {
    sessionStore.toggleFilter(id);
  };

  const handleMoveUp = (id: string) => {
    sessionStore.moveFilterUp(id);
  };

  const handleMoveDown = (id: string) => {
    sessionStore.moveFilterDown(id);
  };

  const handleResetToDefaults = () => {
    sessionStore.resetToDefaults();
  };

  return (
    <div className="h-dvh w-full bg-black text-white overflow-y-auto select-none">
      <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-8 pb-16">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onGoHome}
              className="w-9 h-9 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all active:scale-95"
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
            className="flex items-center gap-2 px-4 py-2 bg-white text-black text-xs font-semibold rounded-full hover:bg-white/90 active:scale-95 transition-all shadow-lg shrink-0"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Launch Camera</span>
          </button>
        </header>

        {/* In-Memory Session Banner Callout */}
        <div className="bg-zinc-900/90 border border-amber-500/30 rounded-xl p-4 text-xs text-amber-200/90 flex gap-3 items-start backdrop-blur-md">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-300">Session-Only Temporary Configuration</p>
            <p className="text-amber-200/70 text-[11px] leading-relaxed">
              Modifications here apply only to your <strong>currently loaded webpage session</strong>. Temporary changes live strictly in-memory and will <strong>automatically reset to default settings upon reloading or refreshing the page</strong>.
            </p>
          </div>
        </div>

        {/* Active Filters Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white tracking-wide">
                Active Gesture Cycle ({activeFilters.length})
              </h2>
            </div>

            <button
              onClick={handleResetToDefaults}
              className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>
          </div>

          {activeFilters.length === 0 ? (
            <div className="p-6 text-center text-xs text-white/40 border border-dashed border-white/10 rounded-xl">
              No filters currently active in cycle. Add filters from below.
            </div>
          ) : (
            <div className="space-y-2.5">
              {activeFilters.map((filter, index) => (
                <div
                  key={filter.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-900 border border-white/15 shadow-md transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center font-mono text-xs font-semibold text-white/80">
                      #{index + 1}
                    </span>
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

                  {/* Actions: Reorder & Remove */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/10">
                      <button
                        onClick={() => handleMoveUp(filter.id)}
                        disabled={index === 0}
                        className="p-1 rounded text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-20 transition-all"
                        title="Move Up"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleMoveDown(filter.id)}
                        disabled={index === activeFilters.length - 1}
                        className="p-1 rounded text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-20 transition-all"
                        title="Move Down"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      onClick={() => handleRemoveFilter(filter.id)}
                      disabled={activeFilters.length <= 1}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium transition-all disabled:opacity-30 disabled:hover:bg-rose-500/10"
                      title={activeFilters.length <= 1 ? 'Minimum 1 filter required' : 'Remove Filter'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Available Built-in Filters Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-white/10 pb-2">
            <Sparkles className="w-4 h-4 text-white/60" />
            <h2 className="text-sm font-semibold text-white tracking-wide">
              Available Built-in Filters ({availableFilters.length})
            </h2>
          </div>

          {availableFilters.length === 0 ? (
            <div className="p-6 text-center text-xs text-emerald-400/80 bg-emerald-950/20 border border-emerald-500/20 rounded-xl flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>All built-in filters are currently added to the gesture cycle.</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {availableFilters.map((filter) => (
                <div
                  key={filter.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950/70 border border-white/10 hover:border-white/20 opacity-80 hover:opacity-100 transition-all"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{filter.displayName}</span>
                      <span className="text-[10px] font-mono text-white/40 bg-white/5 px-2 py-0.5 rounded">
                        {filter.category}
                      </span>
                    </div>
                    <p className="text-xs text-white/50 mt-0.5">{filter.description}</p>
                  </div>

                  {/* Explicit Add Button */}
                  <button
                    onClick={() => handleAddFilter(filter.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-medium transition-all shrink-0 active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Filter</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Footer info */}
        <footer className="text-center pt-6 border-t border-white/10 text-xs text-white/30">
          HandFrame Built-in Filter Registry Interface — Temporary Session Configuration
        </footer>
      </div>
    </div>
  );
};
