import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { createGlbBuilder } from './glb.mjs';
import { GENERATED_DIR, ROOT, openMap, parseArgs, readBytes, writeJson } from './lib.mjs';
import { encodePng, resizeRgba } from './png.mjs';
import {
  buildChannels,
  collectJoints,
  inverseBindMatrices,
  selectSequences,
  skinAttributes,
} from './skeleton.mjs';

const require = createRequire(import.meta.url);

/**
 * Convert the map's MDX models to glb, with their skeletons and animations.
 *
 * Warcraft models are Z-up at 128 units per terrain cell; the game is Y-up with
 * one unit per placement cell. Rather than baking that into every vertex, bone
 * pivot and animation key, the whole model hangs off a single root node that
 * carries the rotation and the scale. That keeps the skinning maths trivial —
 * bind rotations are identity in MDX, so the inverse bind matrices are plain
 * translations — and quaternion tracks pass through untouched.
 */

/** A Warcraft terrain cell is 128 map units; ours is 1 world unit. */
const MODEL_SCALE = 1 / 128;
const MAX_TEXTURE = 512;
/** -90 degrees about X, as (x, y, z, w): turns Z-up into Y-up. */
const Z_UP_TO_Y_UP = [-Math.SQRT1_2, 0, 0, Math.SQRT1_2];
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

/**
 * Warcraft layer filter modes -> glTF alpha modes. Additive and modulate have
 * no glTF equivalent; blending them is the closest honest approximation.
 */
const ALPHA_MODE_BY_FILTER = ['OPAQUE', 'MASK', 'BLEND', 'BLEND', 'BLEND', 'BLEND', 'BLEND'];

function convertModel(model, resolveTexture, name) {
  const builder = createGlbBuilder();
  const textureCache = new Map();
  const materialCache = new Map();
  const warnings = [];

  /** Resolve a material, or null when it has no usable texture. */
  const materialIndexFor = (materialId) => {
    if (materialCache.has(materialId)) return materialCache.get(materialId);

    const material = model.materials[materialId];
    const layer = material?.layers?.[0];
    let result = null;

    if (layer) {
      const texture = model.textures[layer.textureId];
      const texPath = texture?.path;

      // A layer with no path is a replaceable (team colour, shadow) texture we
      // do not ship. Rendering it untextured turns it into an opaque white quad
      // over the model, so the geoset is dropped instead.
      if (texPath) {
        if (!textureCache.has(texPath)) {
          const png = resolveTexture(texPath);
          textureCache.set(texPath, png ? builder.addTexture(png) : null);
          if (!png) warnings.push(`missing texture ${texPath}`);
        }
        const textureIndex = textureCache.get(texPath);
        if (textureIndex !== null && textureIndex !== undefined) {
          result = builder.addMaterial({
            name: `${name}_mat${materialId}`,
            textureIndex,
            unlit: (layer.flags & 1) !== 0, // Unshaded
            alphaMode: ALPHA_MODE_BY_FILTER[layer.filterMode] ?? 'MASK',
          });
        } else {
          warnings.push(`dropped geoset: unreadable texture ${texPath}`);
        }
      } else {
        warnings.push(`dropped geoset: replaceable texture ${texture?.replaceableId ?? '?'}`);
      }
    }

    materialCache.set(materialId, result);
    return result;
  };

  const { joints, indexById } = collectJoints(model);
  const skinned = joints.length > 0;

  const primitives = [];
  let unboundVertices = 0;
  for (const geoset of model.geosets) {
    const material = materialIndexFor(geoset.materialId);
    if (material === null) continue;

    const uvSet = geoset.uvSets?.[0];
    const primitive = {
      // Raw MDX space; the root node handles axes and scale.
      positions: Float32Array.from(geoset.vertices),
      normals: Float32Array.from(geoset.normals),
      uvs: uvSet ? Float32Array.from(uvSet) : null,
      indices: Uint32Array.from(geoset.faces),
      material,
    };

    if (skinned) {
      const skin = skinAttributes(geoset, indexById);
      primitive.joints = skin.joints;
      primitive.weights = skin.weights;
      unboundVertices += skin.skipped;
    }

    primitives.push(primitive);
  }
  if (!primitives.length) return null;
  if (unboundVertices) warnings.push(`${unboundVertices} vertices had no bone group`);

  const meshIndex = builder.addMesh(name, primitives);

  if (!skinned) {
    const meshNode = builder.addNode({ name, mesh: meshIndex });
    const rootNode = builder.addNode({
      name: `${name}_root`,
      rotation: Z_UP_TO_Y_UP,
      scale: [MODEL_SCALE, MODEL_SCALE, MODEL_SCALE],
      children: [meshNode],
    });
    return {
      glb: builder.build({ roots: [rootNode] }),
      warnings,
      geosets: primitives.length,
      clips: [],
      joints: 0,
    };
  }

  // Every joint gets a node with an empty child list, then the hierarchy is
  // wired by pushing into those lists, so a parent may precede or follow a child.
  const jointNodes = joints.map((joint) =>
    builder.addNode({ name: joint.name, translation: joint.bindTranslation, children: [] })
  );
  const skeletonRoots = [];
  joints.forEach((joint, index) => {
    if (joint.parentIndex < 0) {
      skeletonRoots.push(jointNodes[index]);
      return;
    }
    builder.childrenOf(jointNodes[joint.parentIndex]).push(jointNodes[index]);
  });

  const skinIndex = builder.addSkin(jointNodes, inverseBindMatrices(joints));
  const meshNode = builder.addNode({ name, mesh: meshIndex, skin: skinIndex });

  const rootNode = builder.addNode({
    name: `${name}_root`,
    rotation: Z_UP_TO_Y_UP,
    scale: [MODEL_SCALE, MODEL_SCALE, MODEL_SCALE],
    children: [meshNode, ...skeletonRoots],
  });

  const clips = [];
  for (const { clip, sequence } of selectSequences(model)) {
    const channels = buildChannels(joints, sequence, (index) => jointNodes[index]);
    if (!channels.length) continue;
    builder.addAnimation(clip, channels);
    clips.push(clip);
  }

  return {
    glb: builder.build({ roots: [rootNode] }),
    warnings,
    geosets: primitives.length,
    clips,
    joints: joints.length,
  };
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
        joints: result.joints,
        clips: result.clips,
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
  const clipCounts = {};
  for (const entry of converted) {
    for (const clip of entry.clips) clipCounts[clip] = (clipCounts[clip] ?? 0) + 1;
  }

  console.log(`models referenced by units: ${targets.length}`);
  console.log(`converted: ${converted.length} (${(totalBytes / 1e6).toFixed(1)} MB)`);
  console.log(`animated: ${converted.filter((c) => c.clips.length).length}`);
  console.log('clips:', clipCounts);
  console.log(`failed: ${failed.length}`);
  for (const f of failed.slice(0, 8)) console.log(`   ${f.mdxPath}: ${f.reason}`);
}

main();
