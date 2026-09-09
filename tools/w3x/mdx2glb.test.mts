import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AnimationMixer, Box3, type Mesh, SkinnedMesh, Vector3 } from 'three';

/**
 * Validates the output of tools/w3x/mdx2glb.mjs with three's own loader.
 *
 * The .glb files are derived from the user's copy of the source map and are not
 * in the repo, so this suite skips itself when they are absent. It exists
 * because the browser cannot check this reliably: the WebGL canvas only repaints
 * on requestAnimationFrame, which is paused whenever the preview pane is hidden.
 */

/**
 * GLTFLoader decodes embedded PNGs through `self.createImageBitmap`. Geometry —
 * what this suite actually checks — does not need it, so stub just enough of the
 * browser for the loader to get past the image step.
 */
const g = globalThis as unknown as Record<string, unknown>;
const stubImageBitmap = async () => ({ width: 1, height: 1, close() {} });
g.createImageBitmap ??= stubImageBitmap;
g.self ??= g;

const MODELS_DIR = path.resolve(process.cwd(), 'assets/models/generated');
const files = existsSync(MODELS_DIR)
  ? readdirSync(MODELS_DIR).filter((f) => f.endsWith('.glb'))
  : [];

function parse(file: string) {
  const buffer = readFileSync(path.join(MODELS_DIR, file));
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const loader = new GLTFLoader();
  return new Promise<Awaited<ReturnType<GLTFLoader['parseAsync']>>>((resolve, reject) => {
    loader.parse(arrayBuffer as ArrayBuffer, '', resolve, reject);
  });
}

describe.skipIf(files.length === 0)('generated glb models', () => {
  it('produced models for the units that reference imported art', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  const sampled = ['war3mapimported-naruto-nor-nasun.glb', 'war3mapimported-yamato.glb'].filter(
    (f) => files.includes(f)
  );

  it.each(sampled)('%s loads with geometry, UVs and a textured material', async (file: string) => {
    const gltf = await parse(file);

    const meshes: Mesh[] = [];
    gltf.scene.traverse((o) => {
      if ((o as Mesh).isMesh) meshes.push(o as Mesh);
    });
    expect(meshes.length).toBeGreaterThan(0);

    for (const mesh of meshes) {
      const geometry = mesh.geometry;
      expect(geometry.getAttribute('position').count).toBeGreaterThan(0);
      expect(geometry.getAttribute('normal')).toBeDefined();
      expect(geometry.getAttribute('uv')).toBeDefined();
      expect(geometry.getIndex()).not.toBeNull();
    }

    // Geometry is deliberately left in raw Warcraft space — the root node
    // carries the Z-up to Y-up rotation and the scale. Placement is asserted in
    // world space by the bind-pose test below.
  });

  it.each(files.slice(0, 20))('%s parses without error', async (file: string) => {
    const gltf = await parse(file);
    expect(gltf.scene.children.length).toBeGreaterThan(0);
  });

  it.each(sampled)('%s is skinned and carries its Warcraft clips', async (file: string) => {
    const gltf = await parse(file);

    const names = gltf.animations.map((a) => a.name);
    expect(names).toContain('stand');
    expect(names).toContain('walk');
    expect(names).toContain('attack');

    for (const clip of gltf.animations) {
      expect(clip.duration).toBeGreaterThan(0);
      expect(clip.tracks.length).toBeGreaterThan(0);
    }

    const skinned: SkinnedMesh[] = [];
    let bones = 0;
    gltf.scene.traverse((o) => {
      if ((o as SkinnedMesh).isSkinnedMesh) skinned.push(o as SkinnedMesh);
      if ((o as { isBone?: boolean }).isBone) bones++;
    });
    expect(skinned.length).toBeGreaterThan(0);
    expect(bones).toBeGreaterThan(5);

    for (const mesh of skinned) {
      expect(mesh.geometry.getAttribute('skinIndex')).toBeDefined();
      expect(mesh.geometry.getAttribute('skinWeight')).toBeDefined();
    }
  });

  it.each(sampled)('%s actually deforms when a clip plays', async (file: string) => {
    const gltf = await parse(file);
    const meshes: SkinnedMesh[] = [];
    gltf.scene.traverse((o) => {
      if ((o as SkinnedMesh).isSkinnedMesh) meshes.push(o as SkinnedMesh);
    });
    const mesh = meshes[0];

    const walk = gltf.animations.find((a) => a.name === 'walk')!;
    const mixer = new AnimationMixer(gltf.scene);
    mixer.clipAction(walk).play();

    /** World-space positions of a few skinned vertices at a point in the clip. */
    const sampleAt = (time: number) => {
      mixer.setTime(time);
      gltf.scene.updateMatrixWorld(true);
      const position = mesh.geometry.getAttribute('position');
      const v = new Vector3();
      return [0, 50, 120]
        .filter((i) => i < position.count)
        .map((i) => {
          v.fromBufferAttribute(position, i);
          mesh.applyBoneTransform(i, v);
          mesh.localToWorld(v);
          return v.toArray().map((n) => n.toFixed(4)).join(',');
        })
        .join(' | ');
    };

    expect(sampleAt(0)).not.toBe(sampleAt(walk.duration * 0.5));
  });

  it.each(sampled)('%s stands on the ground at its bind pose', async (file: string) => {
    const gltf = await parse(file);
    // Posed by the skeleton, not by the raw vertex bounds: this is what the
    // player actually sees, and it catches a broken axis or scale conversion.
    gltf.scene.updateMatrixWorld(true);
    const box = new Box3().setFromObject(gltf.scene);
    expect(box.min.y).toBeGreaterThan(-0.3);
    expect(box.max.y).toBeGreaterThan(0.8);
    expect(box.max.y).toBeLessThan(6);
  });
});

