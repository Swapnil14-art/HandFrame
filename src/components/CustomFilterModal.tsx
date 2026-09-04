import React, { useState, useEffect, useRef } from 'react';
import { CustomColorMatrixFilter } from '../filters/implementations/CustomColorMatrixFilter';
import { CustomConvolutionFilter } from '../filters/implementations/CustomConvolutionFilter';
import { BaseFilter } from '../filters/types/FilterTypes';
import { X, Sparkles, Sliders, Grid } from 'lucide-react';

interface CustomFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateFilter: (filter: BaseFilter) => void;
}

// Built-in Presets Definition
const COLOR_MATRIX_PRESETS = [
  { name: 'Identity', matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1], offsets: [0, 0, 0] },
  { name: 'Sepia Tone', matrix: [0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131], offsets: [0, 0, 0] },
  { name: 'Red Boost / Thermal', matrix: [1.4, 0, 0, 0, 0.6, 0, 0, 0, 0.6], offsets: [20, 0, 0] },
  { name: 'Cool Teal', matrix: [0.6, 0, 0.2, 0, 1.1, 0.2, 0.2, 0.3, 1.4], offsets: [0, 0, 30] },
  { name: 'High Contrast Invert', matrix: [-1, 0, 0, 0, -1, 0, 0, 0, -1], offsets: [255, 255, 255] },
  { name: 'High Contrast Boost', matrix: [1.5, 0, 0, 0, 1.5, 0, 0, 0, 1.5], offsets: [-40, -40, -40] },
];

const CONVOLUTION_PRESETS = [
  { name: 'Identity (3x3)', size: 3 as const, kernel: [0, 0, 0, 0, 1, 0, 0, 0, 0], divisor: 1, offset: 0 },
  { name: 'Blur (3x3 Box)', size: 3 as const, kernel: [1, 1, 1, 1, 1, 1, 1, 1, 1], divisor: 9, offset: 0 },
  { name: 'Sharpen', size: 3 as const, kernel: [0, -1, 0, -1, 5, -1, 0, -1, 0], divisor: 1, offset: 0 },
  { name: 'Edge Detection', size: 3 as const, kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1], divisor: 1, offset: 0 },
  { name: 'Emboss', size: 3 as const, kernel: [-2, -1, 0, -1, 1, 1, 0, 1, 2], divisor: 1, offset: 128 },
  { name: 'Gaussian Blur (3x3)', size: 3 as const, kernel: [1, 2, 1, 2, 4, 2, 1, 2, 1], divisor: 16, offset: 0 },
  { name: 'Horizontal Edge', size: 3 as const, kernel: [-1, -2, -1, 0, 0, 0, 1, 2, 1], divisor: 1, offset: 128 },
  { name: 'Vertical Edge', size: 3 as const, kernel: [-1, 0, 1, -2, 0, 2, -1, 0, 1], divisor: 1, offset: 128 },
  {
    name: 'Box Blur (5x5)',
    size: 5 as const,
    kernel: [
      1, 1, 1, 1, 1,
      1, 1, 1, 1, 1,
      1, 1, 1, 1, 1,
      1, 1, 1, 1, 1,
      1, 1, 1, 1, 1,
    ],
    divisor: 25,
    offset: 0,
  },
];

export const CustomFilterModal: React.FC<CustomFilterModalProps> = ({
  isOpen,
  onClose,
  onCreateFilter,
}) => {
  const [filterName, setFilterName] = useState('My Custom Matrix');
  const [filterType, setFilterType] = useState<'COLOR_MATRIX' | 'CONVOLUTION'>('COLOR_MATRIX');

  // Color matrix state (3x3 + 3 offsets)
  const [matrix, setMatrix] = useState<number[]>([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const [offsets, setOffsets] = useState<number[]>([0, 0, 0]);

  // Convolution state (3x3 or 5x5)
  const [kernelSize, setKernelSize] = useState<3 | 5>(3);
  const [kernel, setKernel] = useState<number[]>([0, -1, 0, -1, 5, -1, 0, -1, 0]);
  const [divisor, setDivisor] = useState<number>(1);
  const [convOffset, setConvOffset] = useState<number>(0);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Generate test pattern on preview canvas
  useEffect(() => {
    if (!isOpen) return;
    renderPreview();
  }, [isOpen, filterType, matrix, offsets, kernelSize, kernel, divisor, convOffset]);

  const renderPreview = () => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Draw rich test image pattern
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#ff4b5c');
    grad.addColorStop(0.3, '#f9d56e');
    grad.addColorStop(0.6, '#00b4d8');
    grad.addColorStop(1, '#7209b7');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Draw test circles & text
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(w * 0.3, h * 0.4, 25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.arc(w * 0.7, h * 0.6, 20, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('HANDFRAME', w * 0.25, h * 0.85);

    // Instantiate filter and apply to test ImageData
    try {
      const srcImageData = ctx.getImageData(0, 0, w, h);
      let tempFilter: BaseFilter;

      if (filterType === 'COLOR_MATRIX') {
        tempFilter = new CustomColorMatrixFilter('preview', filterName, matrix, offsets);
      } else {
        tempFilter = new CustomConvolutionFilter(
          'preview',
          filterName,
          kernelSize,
          kernel,
          divisor,
          convOffset
        );
      }

      const processed = tempFilter.apply(srcImageData);
      ctx.putImageData(processed, 0, 0);
    } catch (err) {
      console.warn('Preview filter rendering error:', err);
    }
  };

  const handleMatrixCellChange = (index: number, val: string) => {
    const num = parseFloat(val) || 0;
    const newM = [...matrix];
    newM[index] = num;
    setMatrix(newM);
  };

  const handleOffsetChange = (index: number, val: string) => {
    const num = parseFloat(val) || 0;
    const newO = [...offsets];
    newO[index] = num;
    setOffsets(newO);
  };

  const handleKernelCellChange = (index: number, val: string) => {
    const num = parseFloat(val) || 0;
    const newK = [...kernel];
    newK[index] = num;
    setKernel(newK);
  };

  const handleSelectColorPreset = (presetName: string) => {
    const preset = COLOR_MATRIX_PRESETS.find((p) => p.name === presetName);
    if (preset) {
      setMatrix(preset.matrix);
      setOffsets(preset.offsets);
    }
  };

  const handleSelectConvPreset = (presetName: string) => {
    const preset = CONVOLUTION_PRESETS.find((p) => p.name === presetName);
    if (preset) {
      setKernelSize(preset.size);
      setKernel(preset.kernel);
      setDivisor(preset.divisor);
      setConvOffset(preset.offset);
    }
  };

  const handleKernelSizeChange = (newSize: 3 | 5) => {
    setKernelSize(newSize);
    if (newSize === 3) {
      setKernel([0, -1, 0, -1, 5, -1, 0, -1, 0]);
      setDivisor(1);
    } else {
      setKernel(Array(25).fill(1));
      setDivisor(25);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = `custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    let newFilter: BaseFilter;
    if (filterType === 'COLOR_MATRIX') {
      newFilter = new CustomColorMatrixFilter(
        id,
        filterName.trim() || 'Custom Color Matrix',
        matrix,
        offsets,
        'Temporary session color matrix filter'
      );
    } else {
      newFilter = new CustomConvolutionFilter(
        id,
        filterName.trim() || 'Custom Convolution',
        kernelSize,
        kernel,
        divisor,
        convOffset,
        'Temporary session convolution filter'
      );
    }

    onCreateFilter(newFilter);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-white/15 rounded-2xl max-w-xl w-full p-5 space-y-6 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">Create Custom Filter</h2>
            <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded text-white/60">
              Session Memory Only
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          {/* Filter Name & Type Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-white/70 font-medium mb-1.5">Filter Name</label>
              <input
                type="text"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                placeholder="e.g. My Custom Matrix"
                className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-400"
                required
              />
            </div>

            <div>
              <label className="block text-white/70 font-medium mb-1.5">Filter Operation Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-400"
              >
                <option value="COLOR_MATRIX">Color Matrix (3×3 + Offsets)</option>
                <option value="CONVOLUTION">Spatial Convolution Kernel</option>
              </select>
            </div>
          </div>

          {/* COLOR MATRIX EDITOR */}
          {filterType === 'COLOR_MATRIX' && (
            <div className="space-y-4 bg-black/40 border border-white/10 p-4 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white/90 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                  Color Matrix Presets
                </span>
                <select
                  onChange={(e) => handleSelectColorPreset(e.target.value)}
                  className="bg-zinc-800 text-white/80 border border-white/10 rounded px-2 py-1 text-[11px] focus:outline-none"
                >
                  <option value="">Select Preset...</option>
                  {COLOR_MATRIX_PRESETS.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3x3 Matrix Grid */}
              <div>
                <label className="block text-white/60 mb-2 font-mono text-[11px]">
                  Transformation Matrix [3×3]
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {matrix.map((val, i) => (
                    <input
                      key={i}
                      type="number"
                      step="0.05"
                      value={val}
                      onChange={(e) => handleMatrixCellChange(i, e.target.value)}
                      className="bg-zinc-800/90 border border-white/15 rounded px-2 py-1.5 text-center text-white font-mono text-xs focus:border-emerald-400 focus:outline-none"
                    />
                  ))}
                </div>
              </div>

              {/* Offsets */}
              <div>
                <label className="block text-white/60 mb-2 font-mono text-[11px]">
                  RGB Channel Offsets [rOffset, gOffset, bOffset]
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {offsets.map((val, i) => (
                    <input
                      key={i}
                      type="number"
                      step="1"
                      value={val}
                      onChange={(e) => handleOffsetChange(i, e.target.value)}
                      className="bg-zinc-800/90 border border-white/15 rounded px-2 py-1.5 text-center text-white font-mono text-xs focus:border-emerald-400 focus:outline-none"
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* CONVOLUTION EDITOR */}
          {filterType === 'CONVOLUTION' && (
            <div className="space-y-4 bg-black/40 border border-white/10 p-4 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white/90 flex items-center gap-1.5">
                  <Grid className="w-3.5 h-3.5 text-emerald-400" />
                  Convolution Presets & Kernel Size
                </span>
                <div className="flex items-center gap-2">
                  <select
                    value={kernelSize}
                    onChange={(e) => handleKernelSizeChange(parseInt(e.target.value) as any)}
                    className="bg-zinc-800 text-white/80 border border-white/10 rounded px-2 py-1 text-[11px] focus:outline-none"
                  >
                    <option value={3}>3 × 3</option>
                    <option value={5}>5 × 5</option>
                  </select>

                  <select
                    onChange={(e) => handleSelectConvPreset(e.target.value)}
                    className="bg-zinc-800 text-white/80 border border-white/10 rounded px-2 py-1 text-[11px] focus:outline-none"
                  >
                    <option value="">Select Preset...</option>
                    {CONVOLUTION_PRESETS.filter((p) => p.size === kernelSize).map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Kernel Grid */}
              <div>
                <label className="block text-white/60 mb-2 font-mono text-[11px]">
                  Kernel Matrix [{kernelSize}×{kernelSize}]
                </label>
                <div
                  className={`grid gap-1.5 ${
                    kernelSize === 3 ? 'grid-cols-3' : 'grid-cols-5'
                  }`}
                >
                  {kernel.map((val, i) => (
                    <input
                      key={i}
                      type="number"
                      step="0.1"
                      value={val}
                      onChange={(e) => handleKernelCellChange(i, e.target.value)}
                      className="bg-zinc-800/90 border border-white/15 rounded px-1 py-1 text-center text-white font-mono text-xs focus:border-emerald-400 focus:outline-none"
                    />
                  ))}
                </div>
              </div>

              {/* Divisor & Offset */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/60 mb-1 font-mono text-[11px]">
                    Divisor Factor
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={divisor}
                    onChange={(e) => setDivisor(parseFloat(e.target.value) || 1)}
                    className="w-full bg-zinc-800/90 border border-white/15 rounded px-2 py-1.5 text-center text-white font-mono text-xs focus:border-emerald-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-white/60 mb-1 font-mono text-[11px]">
                    Brightness Offset
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={convOffset}
                    onChange={(e) => setConvOffset(parseFloat(e.target.value) || 0)}
                    className="w-full bg-zinc-800/90 border border-white/15 rounded px-2 py-1.5 text-center text-white font-mono text-xs focus:border-emerald-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* LIVE PREVIEW CANVAS */}
          <div className="space-y-2">
            <label className="block text-white/70 font-medium">Live Filter Output Preview</label>
            <div className="flex justify-center bg-black/60 border border-white/15 p-3 rounded-xl">
              <canvas
                ref={previewCanvasRef}
                width={240}
                height={140}
                className="rounded-lg border border-white/10 shadow-lg object-cover"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-xl transition-all"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl transition-all shadow-lg active:scale-95 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Create & Save Filter</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
