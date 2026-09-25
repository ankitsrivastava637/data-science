import type { ChapterFactory } from '../engine/types';
import ch1 from './ch1';
import ch2 from './ch2';
import ch3 from './ch3';

export const FACTORIES: Record<number, ChapterFactory> = {
  1: ch1,
  2: ch2,
  3: ch3,
};
