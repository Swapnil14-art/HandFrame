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
  ];
}
