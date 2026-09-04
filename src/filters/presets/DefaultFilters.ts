import { BaseFilter } from '../types/FilterTypes';
import { OriginalFilter } from '../implementations/OriginalFilter';
import { MoodyFilter } from '../implementations/MoodyFilter';
import { WarmFilter } from '../implementations/WarmFilter';
import { CoolFilter } from '../implementations/CoolFilter';
import { VintageFilmFilter } from '../implementations/VintageFilmFilter';
import { FilmGrainFilter } from '../implementations/FilmGrainFilter';
import { DreamyBlurFilter } from '../implementations/DreamyBlurFilter';
import { CinematicFilter } from '../implementations/CinematicFilter';
import { Y2kDigicamFilter } from '../implementations/Y2kDigicamFilter';
import { VhsFilter } from '../implementations/VhsFilter';
import { PixelateFilter } from '../implementations/PixelateFilter';
import { NegativeFilter } from '../implementations/NegativeFilter';
import { GrayscaleFilter } from '../implementations/GrayscaleFilter';
import { SepiaFilter } from '../implementations/SepiaFilter';
import { RetroFlashFilter } from '../implementations/RetroFlashFilter';

export function createDefaultFilters(): BaseFilter[] {
  return [
    new OriginalFilter(),
    new MoodyFilter(),
    new WarmFilter(),
    new CoolFilter(),
    new VintageFilmFilter(),
    new FilmGrainFilter(),
    new DreamyBlurFilter(),
    new CinematicFilter(),
    new Y2kDigicamFilter(),
    new VhsFilter(),
    new PixelateFilter(),
    new NegativeFilter(),
    new GrayscaleFilter(),
    new SepiaFilter(),
    new RetroFlashFilter(),
  ];
}
