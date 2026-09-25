// Registry of particle targets from earlier chapters, re-used by Chapter 12 (Synthesis).
import type * as THREE from 'three';

export interface TargetEntry { tex: THREE.DataTexture; units: string }
const reg = new Map<string, TargetEntry>();
export function registerTarget(name: string, tex: THREE.DataTexture, units: string) { reg.set(name, { tex, units }); }
export function getTarget(name: string) { return reg.get(name); }
export function targetNames() { return [...reg.keys()]; }
