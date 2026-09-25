import type * as THREE from 'three';
import type { Quality } from './quality';
import type { EquationDraw, HudInfo, Label } from './overlay';
import type { PostParams } from './post';
import type { Shared } from './shared';

export interface Frame {
  /** global timeline seconds */
  t: number;
  /** seconds since the chapter's start (may be negative during an incoming transition) */
  lt: number;
  quality: Quality;
  seed: number;
  /** scene render-target size in pixels */
  width: number;
  height: number;
  aspect: number;
  reducedMotion: boolean;
  renderMode: boolean;
  /** duration of one output frame (s) — used by effects that need a notion of exposure time */
  frameDt: number;
}

export interface ChapterOutput {
  hud: HudInfo;
  labels: Label[];
  equations: EquationDraw[];
  draw: ((ctx: CanvasRenderingContext2D, W: number, H: number, alpha: number) => void)[];
  post: Partial<PostParams>;
}

export function emptyOutput(): ChapterOutput {
  return { hud: { s: null }, labels: [], equations: [], draw: [], post: {} };
}

export interface ChapterInstance {
  /** evaluate all state for time f.t — must be a pure function of (t, seed, quality) */
  update(f: Frame, out: ChapterOutput): void;
  /** render linear HDR colour into target (target is already sized; clear it yourself) */
  render(r: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget, f: Frame): void;
  dispose(): void;
}

export interface EngineContext {
  renderer: THREE.WebGLRenderer;
  quality: Quality;
  seed: number;
  shared: Shared;
  reducedMotion: boolean;
}

export type ChapterFactory = (ctx: EngineContext) => ChapterInstance;
