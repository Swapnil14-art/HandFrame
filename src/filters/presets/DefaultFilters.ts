import { BaseFilter } from '../types/FilterTypes';
import { OriginalFilter } from '../implementations/OriginalFilter';
import { MoodyFilter } from '../implementations/MoodyFilter';
import { FilmGrainFilter } from '../implementations/FilmGrainFilter';
import { CinematicFilter } from '../implementations/CinematicFilter';
import { Y2kDigicamFilter } from '../implementations/Y2kDigicamFilter';
import { VhsFilter } from '../implementations/VhsFilter';
import { PixelateFilter } from '../implementations/PixelateFilter';
import { NegativeFilter } from '../implementations/NegativeFilter';
import { GrayscaleFilter } from '../implementations/GrayscaleFilter';

// Local Real-time Filters (V2 Updated)
import { InfraredFilter } from '../implementations/InfraredFilter';
import { OutlineFilter } from '../implementations/OutlineFilter';
import { EnterMatrixFilter } from '../implementations/EnterMatrixFilter';
import { SpiderVerseFilter } from '../implementations/SpiderVerseFilter';
import { RageShiftFilter } from '../implementations/RageShiftFilter';
import { AnimeRageFilter } from '../implementations/AnimeRageFilter';
import { SketchFilter } from '../implementations/SketchFilter';
import { GlitchOutFilter } from '../implementations/GlitchOutFilter';

// Additional Image Processing Filters
import { SpectralMapFilter } from '../implementations/SpectralMapFilter';
import { ThresholdFilter } from '../implementations/ThresholdFilter';
import { RgbSplitFilter } from '../implementations/RgbSplitFilter';
import { LightGlowFilter } from '../implementations/LightGlowFilter';
import { PaletteMapFilter } from '../implementations/PaletteMapFilter';
import { PosterizeFilter } from '../implementations/PosterizeFilter';
import { RaysFilter } from '../implementations/RaysFilter';
import { BwDazeFilter } from '../implementations/BwDazeFilter';
import { ReverseHeatmapFilter } from '../implementations/ReverseHeatmapFilter';
import { GreenPixelFilter } from '../implementations/GreenPixelFilter';
import { MonoColorsFilter } from '../implementations/MonoColorsFilter';

export function createDefaultFilters(): BaseFilter[] {
  return [
    // 9 Core Filters
    new OriginalFilter(),
    new MoodyFilter(),
    new FilmGrainFilter(),
    new CinematicFilter(),
    new Y2kDigicamFilter(),
    new VhsFilter(),
    new PixelateFilter(),
    new NegativeFilter(),
    new GrayscaleFilter(),

    // V2 Updated & New Filters
    new EnterMatrixFilter(),
    new SpiderVerseFilter(),
    new RageShiftFilter(),
    new AnimeRageFilter(),
    new SketchFilter(),
    new GlitchOutFilter(),

    // Real-Time Visual Filters
    new InfraredFilter(),
    new OutlineFilter(),

    // Additional Built-in Filters
    new SpectralMapFilter(),
    new ThresholdFilter(),
    new RgbSplitFilter(),
    new LightGlowFilter(),
    new PaletteMapFilter(),
    new PosterizeFilter(),
    new RaysFilter(),
    new BwDazeFilter(),
    new ReverseHeatmapFilter(),
    new GreenPixelFilter(),
    new MonoColorsFilter(),
  ];
}
