import { BaseFilter } from '../types/FilterTypes';
import { OriginalFilter } from '../implementations/OriginalFilter';
import { FilmGrainFilter } from '../implementations/FilmGrainFilter';
import { PixelateFilter } from '../implementations/PixelateFilter';
import { NegativeFilter } from '../implementations/NegativeFilter';
import { GrayscaleFilter } from '../implementations/GrayscaleFilter';

// Local Real-time Filters (V2 Updated)
import { OutlineFilter } from '../implementations/OutlineFilter';
import { EnterMatrixFilter } from '../implementations/EnterMatrixFilter';
import { RageShiftFilter } from '../implementations/RageShiftFilter';
import { MovingRageMotionFilter } from '../implementations/MovingRageMotionFilter';
import { SketchFilter } from '../implementations/SketchFilter';
import { GlitchOutFilter } from '../implementations/GlitchOutFilter';
import { RetroArcadeFilter } from '../implementations/RetroArcadeFilter';

// Additional Image Processing Filters
import { SpectralMapFilter } from '../implementations/SpectralMapFilter';
import { ThresholdFilter } from '../implementations/ThresholdFilter';
import { RgbSplitFilter } from '../implementations/RgbSplitFilter';
import { BwDazeFilter } from '../implementations/BwDazeFilter';
import { ReverseHeatmapFilter } from '../implementations/ReverseHeatmapFilter';
import { CutoutFilter } from '../implementations/CutoutFilter';

export function createDefaultFilters(): BaseFilter[] {
  return [
    // Core Filters
    new OriginalFilter(),
    new FilmGrainFilter(),
    new PixelateFilter(),
    new NegativeFilter(),
    new GrayscaleFilter(),

    // V2 Updated & Dynamic Filters
    new EnterMatrixFilter(),
    new RageShiftFilter(),
    new MovingRageMotionFilter(),
    new SketchFilter(),
    new GlitchOutFilter(),
    new RetroArcadeFilter(),

    // Real-Time Visual Filters
    new OutlineFilter(),

    // Additional Built-in Filters
    new SpectralMapFilter(),
    new ThresholdFilter(),
    new RgbSplitFilter(),
    new BwDazeFilter(),
    new ReverseHeatmapFilter(),
    new CutoutFilter(),
  ];
}

