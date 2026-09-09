import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Mesh } from 'three';

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

    // Y-up after the Z-up conversion: the model stands on the ground plane and
    // is roughly person-sized in world units (one unit = one placement cell).
    const box = boundsOf(meshes);
    expect(box.min.y).toBeGreaterThan(-0.2);
    expect(box.max.y).toBeGreaterThan(1);
    expect(box.max.y).toBeLessThan(6);
  });

  it.each(files.slice(0, 20))('%s parses without error', async (file: string) => {
    const gltf = await parse(file);
    expect(gltf.scene.children.length).toBeGreaterThan(0);
  });
});

function boundsOf(meshes: Mesh[]) {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const mesh of meshes) {
    mesh.geometry.computeBoundingBox();
    const b = mesh.geometry.boundingBox!;
    min.x = Math.min(min.x, b.min.x);
    min.y = Math.min(min.y, b.min.y);
    min.z = Math.min(min.z, b.min.z);
    max.x = Math.max(max.x, b.max.x);
    max.y = Math.max(max.y, b.max.y);
    max.z = Math.max(max.z, b.max.z);
  }
  return { min, max };
}
