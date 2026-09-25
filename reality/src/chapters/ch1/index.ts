// Chapter 1 · Observer — eye → pupil → fundus → inner retina → cone mosaic → an image of a
// living cell assembled from individual photon absorptions.
import * as THREE from 'three';
import type { ChapterInstance, ChapterOutput, EngineContext, Frame } from '../../engine/types';
import { FullscreenPass } from '../../engine/post';
import { logTrack, track, registerRig, type CameraPose } from '../../engine/choreo';
import { ramp, clamp, trap } from '../../engine/ease';
import { makeEyeMaterial } from './eye';
import { makeFundusMaterial, makeFundusTexture, DISC } from './fundus';
import { MosaicLayer, makeInnerRetina } from './mosaic';
import { projectToScreen, camRotation } from '../util';
import { LEVEL_COLOR } from '../../engine/overlay';

// ── choreography (local seconds) ──
const eyeWidthMm = logTrack([[0, 23], [10.5, 9.0, 'sineInOut'], [16.4, 2.2, 'cubicIn']]);
const eyeFov = track([[0, 28], [10, 26], [16.4, 16, 'sineIn']]);
const retinaWidthMm = logTrack([[16, 30], [22, 11], [28.5, 1.3, 'sineInOut'], [34, 0.34, 'sineInOut'], [44, 0.15, 'sineOut']]);
const FUNDUS_FOV = 50;
export const EXPOSURE_START = 45, EXPOSURE_LEN = 13, EXPOSURE_POW = 1.7;
export const tauOf = (lt: number) => Math.pow(clamp((lt - EXPOSURE_START) / EXPOSURE_LEN), EXPOSURE_POW);
export const tauInv = (x: number) => EXPOSURE_START + EXPOSURE_LEN * Math.pow(Math.max(0, x), 1 / EXPOSURE_POW);

export function ch1Scale(lt: number): number {
  return lt < 16.2 ? Math.log10(eyeWidthMm(lt) / 1000) : Math.log10(retinaWidthMm(lt) / 1000);
}

export function eyePose(lt: number, aspect: number, out: CameraPose): CameraPose {
  const w = eyeWidthMm(lt), fov = eyeFov(lt);
  const tanHalf = Math.tan((fov * Math.PI) / 360);
  const d = w / (2 * tanHalf * aspect);
  const az = -0.05 + 0.09 * Math.sin(lt * 0.13), el = 0.035 * Math.sin(lt * 0.09 + 1);
  out.target.set(0, 0, 10.4);
  out.position.set(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, 10.4 + Math.cos(az) * Math.cos(el) * d);
  out.up.set(0, 1, 0);
  out.fov = fov;
  return out;
}

export function mosaicPose(lt: number, aspect: number, out: CameraPose): CameraPose {
  const wUm = retinaWidthMm(lt) * 1000;
  const fov = 36;
  const tanHalf = Math.tan((fov * Math.PI) / 360);
  const d = wUm / (2 * tanHalf * aspect);
  const tilt = 0.10 * (1 - ramp(30, 40, lt));
  out.target.set(0, 0, 0);
  out.position.set(0, -Math.sin(tilt) * d, Math.cos(tilt) * d);
  out.up.set(0, 1, 0);
  out.fov = fov;
  return out;
}

export default function create(ctx: EngineContext): ChapterInstance {
  const { shared } = ctx;
  const eyeMat = makeEyeMaterial();
  const eyePass = new FullscreenPass(eyeMat);
  const fundusTex = makeFundusTexture(ctx.seed);
  const fundusMat = makeFundusMaterial(fundusTex);
  const fundusPass = new FullscreenPass(fundusMat);
  const mosaic = new MosaicLayer(shared.mosaic);
  const inner = makeInnerRetina(ctx.seed, Math.round(2600 * Math.min(1.5, ctx.quality.particles + 0.3)));
  const scene = new THREE.Scene();
  scene.add(inner, mosaic.points);
  const cam = new THREE.PerspectiveCamera(36, 16 / 9, 0.5, 50000);
  const eyeCam = new THREE.PerspectiveCamera(28, 16 / 9, 0.01, 1000);
  const fCam = new THREE.PerspectiveCamera(FUNDUS_FOV, 16 / 9, 0.001, 100);
  const pose: CameraPose = { position: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), fov: 30 };
  registerRig('ch1.eye', (lt) => eyePose(lt, 16 / 9, { position: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3(), fov: 30 }));
  registerRig('ch1.mosaic', (lt) => mosaicPose(lt, 16 / 9, { position: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3(), fov: 30 }));

  let w = { eye: 0, fundus: 0, inner: 0, mosaic: 0 };

  return {
    update(f: Frame, out: ChapterOutput) {
      const lt = f.lt;
      w = {
        eye: 1 - ramp(14.9, 16.4, lt),
        fundus: ramp(16.1, 18.6, lt) * (1 - ramp(27.3, 29.8, lt)),
        inner: ramp(26.8, 29, lt) * (1 - ramp(33.0, 36.0, lt)),
        mosaic: ramp(27.6, 30.6, lt),
      };
      // eye
      if (w.eye > 0) {
        eyePose(lt, f.aspect, pose);
        eyeCam.aspect = f.aspect; eyeCam.fov = pose.fov; eyeCam.updateProjectionMatrix();
        eyeCam.position.copy(pose.position); eyeCam.up.copy(pose.up); eyeCam.lookAt(pose.target); eyeCam.updateMatrixWorld();
        const u = eyeMat.uniforms;
        u.camPos.value.copy(eyeCam.position);
        camRotation(eyeCam, u.camRot.value);
        u.tanHalf.value = Math.tan((pose.fov * Math.PI) / 360);
        u.aspect.value = f.aspect;
        u.weight.value = w.eye;
        u.time.value = f.t;
        u.pupilR.value = 2.2 + 0.15 * ramp(10, 16, lt);
        u.lidOpen.value = 1 + 0.6 * ramp(8, 15, lt);
      }
      // fundus: camera travels from behind the lens toward the fovea
      if (w.fundus > 0) {
        const wmm = retinaWidthMm(lt);
        const tanHalf = Math.tan((FUNDUS_FOV * Math.PI) / 360);
        const d = wmm / (2 * tanHalf * f.aspect);
        const aim = 1 - ramp(17, 27, lt);
        const tx = 1.6 * aim, ty = 0.25 * aim;
        fCam.aspect = f.aspect; fCam.updateProjectionMatrix();
        fCam.position.set(tx * 0.35, ty * 0.35, -12 + d);
        fCam.up.set(0, 1, 0);
        fCam.lookAt(tx, ty, -12);
        fCam.updateMatrixWorld();
        const u = fundusMat.uniforms;
        u.camPos.value.copy(fCam.position);
        camRotation(fCam, u.camRot.value);
        u.tanHalf.value = tanHalf; u.aspect.value = f.aspect; u.weight.value = w.fundus;
        u.aperture.value = lt < 21 ? 0.55 + 2.5 * ramp(16.5, 21, lt) : -1;
        if (trap(18.5, 25.5, lt, 1, 1) > 0) {
          const a = trap(18.5, 25.5, lt, 1, 1);
          const disc = projectToScreen(fCam, new THREE.Vector3(...discWorld()));
          const fov = projectToScreen(fCam, new THREE.Vector3(0, 0, -12));
          if (disc.visible) out.labels.push({ x: disc.x + 0.05, y: disc.y - 0.07, text: 'optic disc', alpha: a * w.fundus, leader: { x: disc.x, y: disc.y } });
          if (fov.visible) out.labels.push({ x: fov.x - 0.05, y: fov.y + 0.09, text: 'fovea', align: 'right', alpha: a * w.fundus, leader: { x: fov.x, y: fov.y } });
        }
      }
      // retina layers and mosaic
      if (w.inner > 0 || w.mosaic > 0) {
        mosaicPose(lt, f.aspect, pose);
        cam.aspect = f.aspect; cam.fov = pose.fov; cam.near = Math.max(0.05, pose.position.length() * 0.01); cam.far = pose.position.length() * 50 + 2000;
        cam.updateProjectionMatrix();
        cam.position.copy(pose.position); cam.up.copy(pose.up); cam.lookAt(pose.target); cam.updateMatrixWorld();
        const proj = f.height / (2 * Math.tan((pose.fov * Math.PI) / 360));
        (inner.material as THREE.ShaderMaterial).uniforms.uProj.value = proj;
        (inner.material as THREE.ShaderMaterial).uniforms.uWeight.value = w.inner;
        inner.visible = w.inner > 0;
        const mu = mosaic.mat.uniforms;
        mu.uProj.value = proj;
        mu.uWeight.value = w.mosaic * 0.9;
        mu.uFalse.value = ramp(36.5, 38.8, lt) * (1 - 0.0);
        mu.uPhoton.value = ramp(43.5, 45.5, lt);
        mu.uRecon.value = ramp(56.3, 59.6, lt);
        mu.uSpread.value = ramp(56.3, 59.6, lt);
        const flashDur = f.reducedMotion ? 0.35 : 0.12;
        mosaic.setExposure(tauOf(lt), lt, tauInv, flashDur);
        mosaic.points.visible = w.mosaic > 0;
        // legend and annotations drawn in screen space
        const legendA = trap(37, 56.5, lt, 1.2, 1.2) * w.mosaic;
        if (legendA > 0.01) {
          out.draw.push((g, W, H, a0) => {
            const u = H / 1080;
            const x0 = W * 0.95 - 150 * u, y0 = H * 0.05 + 170 * u;
            g.globalAlpha = legendA * a0;
            g.font = `400 ${Math.round(15 * u)}px Inter, sans-serif`;
            g.textAlign = 'left';
            const items: [string, string][] = [['#ff5c38', 'L cone'], ['#6bf25a', 'M cone'], ['#4873ff', 'S cone']];
            items.forEach(([c, t], i) => {
              g.fillStyle = c; g.beginPath(); g.arc(x0, y0 + i * 26 * u, 5 * u, 0, Math.PI * 2); g.fill();
              g.fillStyle = '#ddd6c8'; g.fillText(t, x0 + 16 * u, y0 + i * 26 * u + 5 * u);
            });
            g.fillStyle = '#9d968a'; g.font = `400 ${Math.round(12.5 * u)}px Inter, sans-serif`;
            g.fillText('false colour', x0, y0 + 3 * 26 * u + 2 * u);
          });
        }
        const sA = trap(42, 46.8, lt, 0.8, 0.8) * w.mosaic;
        if (sA > 0.01) {
          const c = projectToScreen(cam, new THREE.Vector3(0, 0, 0));
          const e = projectToScreen(cam, new THREE.Vector3(50, 0, 0));
          out.draw.push((g, W, H, a0) => {
            const u = H / 1080;
            g.globalAlpha = sA * a0 * 0.8;
            g.strokeStyle = '#e8e1d2'; g.setLineDash([6 * u, 6 * u]); g.lineWidth = 1.2 * u;
            g.beginPath(); g.arc(c.x * W, c.y * H, Math.abs(e.x - c.x) * W, 0, Math.PI * 2); g.stroke();
            g.setLineDash([]);
            g.fillStyle = '#e8e1d2'; g.font = `400 ${Math.round(15 * u)}px Inter, sans-serif`; g.textAlign = 'left';
            g.fillText('no S cones', e.x * W + 10 * u, c.y * H - 8 * u);
          });
        }
        const pA = trap(45.5, 58.5, lt, 1, 1.5) * w.mosaic;
        if (pA > 0.01) {
          let total = 0;
          for (let i = 0; i < mosaic.counts.length; i++) total += mosaic.counts[i];
          out.labels.push({ x: 0.95, y: 0.9 - 0.0, text: `photon absorptions: ${Math.round(total).toLocaleString('en-US')}`, align: 'right', alpha: pA, size: 0.95, level: 'ESTABLISHED' });
        }
      }
      out.hud = { s: ch1Scale(lt) };
      out.post = { exposure: lt < 16 ? 0.85 : 1.0, bloom: lt < 16 ? 0.03 : 0.05, vignette: 0.38 };
    },
    render(r, target) {
      r.setRenderTarget(target);
      r.setClearColor(0x000000, 1);
      r.clear(true, true, false);
      if (w.eye > 0.001) eyePass.render(r, target);
      if (w.fundus > 0.001) fundusPass.render(r, target);
      if (w.inner > 0.001 || w.mosaic > 0.001) { r.setRenderTarget(target); r.render(scene, cam); }
    },
    dispose() {
      eyeMat.dispose(); fundusMat.dispose(); fundusTex.dispose(); mosaic.dispose();
      inner.geometry.dispose(); (inner.material as THREE.Material).dispose();
    },
  };
}

function discWorld(): [number, number, number] {
  const R = 12;
  const arc = Math.hypot(DISC.x, DISC.y);
  const a = arc / R, phi = Math.atan2(DISC.y, DISC.x);
  return [R * Math.sin(a) * Math.cos(phi), R * Math.sin(a) * Math.sin(phi), -R * Math.cos(a)];
}

export { LEVEL_COLOR };
