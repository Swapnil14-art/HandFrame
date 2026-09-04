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
    new OriginalFilter(),
    new MoodyFilter(),
    new FilmGrainFilter(),
    new CinematicFilter(),
    new Y2kDigicamFilter(),
    new VhsFilter(),
    new PixelateFilter(),
    new NegativeFilter(),
    new GrayscaleFilter(),
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
