import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { createGlbBuilder } from './glb.mjs';
import { GENERATED_DIR, ROOT, openMap, parseArgs, readBytes, writeJson } from './lib.mjs';
import { encodePng, resizeRgba } from './png.mjs';

const require = createRequire(import.meta.url);

/**
 * Convert the map's MDX models to glb.
 *
 * Phase 1 (this file): static bind pose with the first texture layer per
 * material. That is enough to replace the placeholder capsules; skinned
 * Stand/Walk/Attack clips are the M5 follow-up, and the visual registry falls
 * back to a primitive for anything that fails here.
 *
 * Warcraft is Z-up with ~100 units per terrain cell; the game is Y-up with one
 * unit per placement cell, hence the axis swap and MODEL_SCALE below.
 */

// A Warcraft terrain cell is 128 map units; ours is 1 world unit.
const MODEL_SCALE = 1 / 128;
const MAX_TEXTURE = 512;
const OUT_MODELS = path.join(ROOT, 'assets/models/generated');

/** BlpImage.getMipmap builds an ImageData; node has no such global. */
function installImageDataShim() {
  if (typeof globalThis.ImageData === 'undefined') {
    globalThis.ImageData = class ImageData {
      // The DOM constructor takes either (width, height) or (data, width, height).
      constructor(a, b, c) {
        if (typeof a === 'number') {
          this.width = a;
          this.height = b;
          this.data = new Uint8ClampedArray(a * b * 4);
        } else {
          this.data = a;
          this.width = b;
          this.height = c;
        }
      }
    };
  }
}

function decodeBlp(bytes) {
  const { BlpImage } = require('mdx-m3-viewer/dist/cjs/parsers/blp/image');
  const image = new BlpImage();
  image.load(bytes);
  const mip = image.getMipmap(0);
  return { rgba: new Uint8Array(mip.data.buffer ?? mip.data), width: mip.width, height: mip.height };
}

/** MDX faces are grouped; v800 models in this map are all triangle lists. */
function trianglesOf(geoset) {
  return Uint32Array.from(geoset.faces);
}

function convertModel(model, resolveTexture, name) {
  const builder = createGlbBuilder();
  const textureCache = new Map();
  const warnings = [];

  const materialIndexFor = (materialId) => {
    const material = model.materials[materialId];
    const layer = material?.layers?.[0];
    let textureIndex;
    let unlit = false;

    if (layer) {
      unlit = (layer.flags & 1) !== 0; // Unshaded
      const texture = model.textures[layer.textureId];
      const texPath = texture?.path;
      if (texPath) {
        if (!textureCache.has(texPath)) {
          const png = resolveTexture(texPath);
          textureCache.set(texPath, png ? builder.addTexture(png) : null);
          if (!png) warnings.push(`missing texture ${texPath}`);
        }
        textureIndex = textureCache.get(texPath) ?? undefined;
      }
    }
    return builder.addMaterial({
      name: `${name}_mat${materialId}`,
      textureIndex,
      unlit,
      // Warcraft leans on alpha-tested foliage/hair planes.
      alphaMode: 'MASK',
    });
  };

  const primitives = [];
  for (const geoset of model.geosets) {
    const count = geoset.vertices.length / 3;
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Z-up -> Y-up: (x, y, z) becomes (x, z, -y).
      positions[i * 3] = geoset.vertices[i * 3] * MODEL_SCALE;
      positions[i * 3 + 1] = geoset.vertices[i * 3 + 2] * MODEL_SCALE;
      positions[i * 3 + 2] = -geoset.vertices[i * 3 + 1] * MODEL_SCALE;
      normals[i * 3] = geoset.normals[i * 3];
      normals[i * 3 + 1] = geoset.normals[i * 3 + 2];
      normals[i * 3 + 2] = -geoset.normals[i * 3 + 1];
    }

    const uvSet = geoset.uvSets?.[0];
    const uvs = uvSet ? Float32Array.from(uvSet) : null;

    primitives.push({
      positions,
      normals,
      uvs,
      indices: trianglesOf(geoset),
      material: materialIndexFor(geoset.materialId),
    });
  }

  if (!primitives.length) return null;
  builder.addMesh(name, primitives);
  return { glb: builder.build(), warnings, geosets: primitives.length };
}

function main() {
  const args = parseArgs();
  installImageDataShim();

  const map = openMap(args.map);
  const archive = map.archive;
  const Model = require('mdx-m3-viewer/dist/cjs/parsers/mdlx/model').default;

  const units = JSON.parse(
    readFileSync(path.join(GENERATED_DIR, 'units.raw.json'), 'utf8')
  ).units;

  // Only convert models actually referenced by a playable unit, and only the
  // imported ones (the rest are stock Warcraft assets we do not ship).
  const wanted = new Map();
  for (const unit of units) {
    if (!unit.model) continue;
    const mdx = unit.model.replace(/\.mdl$/i, '.mdx');
    if (!/^war3mapImported\\/i.test(mdx)) continue;
    if (!wanted.has(mdx)) wanted.set(mdx, []);
    wanted.get(mdx).push(unit.id);
  }

  const targets = [...wanted.entries()];
  const limited = args.limit ? targets.slice(0, args.limit) : targets;

  const textureCache = new Map();
  const resolveTexture = (texPath) => {
    if (textureCache.has(texPath)) return textureCache.get(texPath);
    let png = null;
    const bytes = readBytes(archive, texPath) ?? readBytes(archive, texPath.replace(/\//g, '\\'));
    if (bytes) {
      try {
        const decoded = decodeBlp(bytes);
        const sized = resizeRgba(decoded.rgba, decoded.width, decoded.height, MAX_TEXTURE);
        png = encodePng(sized.rgba, sized.width, sized.height);
      } catch (error) {
        png = null;
        console.warn(`  ! texture ${texPath}: ${error.message}`);
      }
    }
    textureCache.set(texPath, png);
    return png;
  };

  mkdirSync(OUT_MODELS, { recursive: true });

  const converted = [];
  const failed = [];

  for (const [mdxPath, unitIds] of limited) {
    const bytes = readBytes(archive, mdxPath);
    const assetName = path
      .basename(mdxPath)
      .replace(/\.mdx$/i, '')
      .replace(/[^0-9A-Za-z]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();

    if (!bytes) {
      failed.push({ mdxPath, reason: 'not in archive' });
      continue;
    }
    try {
      const model = new Model();
      model.load(bytes);
      const result = convertModel(model, resolveTexture, assetName);
      if (!result) {
        failed.push({ mdxPath, reason: 'no geosets' });
        continue;
      }
      const file = path.join(OUT_MODELS, `${assetName}.glb`);
      writeFileSync(file, result.glb);
      converted.push({
        asset: assetName,
        file: path.relative(ROOT, file),
        mdxPath,
        unitIds,
        bytes: result.glb.length,
        geosets: result.geosets,
        warnings: result.warnings,
      });
    } catch (error) {
      failed.push({ mdxPath, reason: error.message });
    }
  }

  writeJson(path.join(GENERATED_DIR, 'models.raw.json'), {
    scale: MODEL_SCALE,
    maxTexture: MAX_TEXTURE,
    converted: converted.map(({ warnings, ...rest }) => ({
      ...rest,
      warnings: warnings.length ? warnings : undefined,
    })),
    failed,
  });

  const totalBytes = converted.reduce((a, c) => a + c.bytes, 0);
  console.log(`models referenced by units: ${targets.length}`);
  console.log(`converted: ${converted.length} (${(totalBytes / 1e6).toFixed(1)} MB)`);
  console.log(`failed: ${failed.length}`);
  for (const f of failed.slice(0, 10)) console.log(`   ${f.mdxPath}: ${f.reason}`);
}

main();
