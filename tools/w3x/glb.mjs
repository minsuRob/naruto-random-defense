/**
 * Minimal binary glTF (.glb) writer: static and skinned meshes, plus animation.
 *
 * Written directly rather than through three's GLTFExporter, which reaches for
 * Blob and FileReader when it embeds images and expects a DOM.
 */

const COMPONENT = {
  UNSIGNED_SHORT: 5123,
  UNSIGNED_INT: 5125,
  FLOAT: 5126,
};
const TARGET = { ARRAY_BUFFER: 34962, ELEMENT_ARRAY_BUFFER: 34963 };
const TYPE_SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function align4(n) {
  return (n + 3) & ~3;
}

export function createGlbBuilder() {
  const buffers = [];
  let byteLength = 0;
  const bufferViews = [];
  const accessors = [];
  const images = [];
  const samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
  const textures = [];
  const materials = [];
  const meshes = [];
  const nodes = [];
  const skins = [];
  const animations = [];

  function addBufferView(data, target) {
    const padding = align4(byteLength) - byteLength;
    if (padding) {
      buffers.push(Buffer.alloc(padding));
      byteLength += padding;
    }
    const bytes = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    const view = { buffer: 0, byteOffset: byteLength, byteLength: bytes.length };
    if (target) view.target = target;
    buffers.push(bytes);
    byteLength += bytes.length;
    bufferViews.push(view);
    return bufferViews.length - 1;
  }

  function addAccessor(data, type, componentType, target, minMax) {
    const count = data.length / TYPE_SIZE[type];
    const accessor = {
      bufferView: addBufferView(data, target),
      componentType,
      count,
      type,
    };
    if (minMax) {
      accessor.min = minMax.min;
      accessor.max = minMax.max;
    }
    accessors.push(accessor);
    return accessors.length - 1;
  }

  function bounds(positions) {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) {
      for (let c = 0; c < 3; c++) {
        const v = positions[i + c];
        if (v < min[c]) min[c] = v;
        if (v > max[c]) max[c] = v;
      }
    }
    return { min, max };
  }

  const api = {
    /** @param png Buffer of PNG bytes. Returns a texture index. */
    addTexture(png) {
      const bufferView = addBufferView(png);
      images.push({ bufferView, mimeType: 'image/png' });
      textures.push({ sampler: 0, source: images.length - 1 });
      return textures.length - 1;
    },

    addMaterial({ name, textureIndex, doubleSided = true, alphaMode = 'MASK', unlit = false }) {
      const material = {
        name,
        doubleSided,
        alphaMode,
        alphaCutoff: alphaMode === 'MASK' ? 0.5 : undefined,
        pbrMetallicRoughness: {
          baseColorFactor: [1, 1, 1, 1],
          metallicFactor: 0,
          roughnessFactor: 1,
        },
      };
      if (textureIndex !== undefined && textureIndex !== null) {
        material.pbrMetallicRoughness.baseColorTexture = { index: textureIndex };
      }
      // Warcraft "unshaded" layers ignore lighting; KHR_materials_unlit says so.
      if (unlit) material.extensions = { KHR_materials_unlit: {} };
      materials.push(material);
      return materials.length - 1;
    },

    /** primitives: [{ positions, normals, uvs, indices, joints, weights, material }] */
    addMesh(name, primitives) {
      const meshPrimitives = primitives.map((p) => {
        const attributes = {
          POSITION: addAccessor(
            p.positions,
            'VEC3',
            COMPONENT.FLOAT,
            TARGET.ARRAY_BUFFER,
            bounds(p.positions)
          ),
        };
        if (p.normals) {
          attributes.NORMAL = addAccessor(p.normals, 'VEC3', COMPONENT.FLOAT, TARGET.ARRAY_BUFFER);
        }
        if (p.uvs) {
          attributes.TEXCOORD_0 = addAccessor(p.uvs, 'VEC2', COMPONENT.FLOAT, TARGET.ARRAY_BUFFER);
        }
        if (p.joints) {
          attributes.JOINTS_0 = addAccessor(
            p.joints,
            'VEC4',
            COMPONENT.UNSIGNED_SHORT,
            TARGET.ARRAY_BUFFER
          );
          attributes.WEIGHTS_0 = addAccessor(
            p.weights,
            'VEC4',
            COMPONENT.FLOAT,
            TARGET.ARRAY_BUFFER
          );
        }
        return {
          attributes,
          indices: addAccessor(
            p.indices,
            'SCALAR',
            COMPONENT.UNSIGNED_INT,
            TARGET.ELEMENT_ARRAY_BUFFER
          ),
          material: p.material,
        };
      });
      meshes.push({ name, primitives: meshPrimitives });
      return meshes.length - 1;
    },

    /** Returns the node index. The node object is kept by reference. */
    addNode(node) {
      nodes.push(node);
      return nodes.length - 1;
    },

    /**
     * The child list of a node, for wiring a hierarchy after the fact — joints
     * can name a parent that has not been created yet.
     */
    childrenOf(index) {
      const node = nodes[index];
      if (!node.children) node.children = [];
      return node.children;
    },

    /** @param inverseBindMatrices Float32Array of 16 floats per joint. */
    addSkin(joints, inverseBindMatrices) {
      skins.push({
        joints,
        inverseBindMatrices: addAccessor(inverseBindMatrices, 'MAT4', COMPONENT.FLOAT),
      });
      return skins.length - 1;
    },

    /**
     * channels: [{ node, path: 'translation'|'rotation'|'scale',
     *              times: Float32Array, values: Float32Array,
     *              interpolation: 'LINEAR'|'STEP' }]
     */
    addAnimation(name, channels) {
      const samplers = [];
      const outChannels = [];
      for (const channel of channels) {
        const type = channel.path === 'rotation' ? 'VEC4' : 'VEC3';
        samplers.push({
          input: addAccessor(channel.times, 'SCALAR', COMPONENT.FLOAT, undefined, {
            min: [channel.times[0]],
            max: [channel.times[channel.times.length - 1]],
          }),
          output: addAccessor(channel.values, type, COMPONENT.FLOAT),
          interpolation: channel.interpolation ?? 'LINEAR',
        });
        outChannels.push({
          sampler: samplers.length - 1,
          target: { node: channel.node, path: channel.path },
        });
      }
      animations.push({ name, samplers, channels: outChannels });
      return animations.length - 1;
    },

    build({ generator = 'nrd tools/w3x/mdx2glb', roots } = {}) {
      const extensionsUsed = materials.some((m) => m.extensions?.KHR_materials_unlit)
        ? ['KHR_materials_unlit']
        : undefined;

      const gltf = {
        asset: { version: '2.0', generator },
        extensionsUsed,
        scene: 0,
        scenes: [{ nodes: roots ?? nodes.map((_, i) => i) }],
        nodes,
        meshes,
        materials,
        accessors,
        bufferViews,
        buffers: [{ byteLength }],
      };
      if (skins.length) gltf.skins = skins;
      if (animations.length) gltf.animations = animations;
      if (images.length) {
        gltf.images = images;
        gltf.samplers = samplers;
        gltf.textures = textures;
      }

      const binChunk = Buffer.concat(buffers);
      const binPadding = align4(binChunk.length) - binChunk.length;
      const bin = Buffer.concat([binChunk, Buffer.alloc(binPadding)]);
      // buffers[0].byteLength must match the chunk, padding included.
      gltf.buffers[0].byteLength = bin.length;

      const jsonText = Buffer.from(JSON.stringify(gltf), 'utf8');
      const jsonPadding = align4(jsonText.length) - jsonText.length;
      const json = Buffer.concat([jsonText, Buffer.alloc(jsonPadding, 0x20)]);

      const header = Buffer.alloc(12);
      header.write('glTF', 0, 'ascii');
      header.writeUInt32LE(2, 4);
      header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);

      const jsonHeader = Buffer.alloc(8);
      jsonHeader.writeUInt32LE(json.length, 0);
      jsonHeader.write('JSON', 4, 'ascii');

      const binHeader = Buffer.alloc(8);
      binHeader.writeUInt32LE(bin.length, 0);
      binHeader.write('BIN\0', 4, 'ascii');

      return Buffer.concat([header, jsonHeader, json, binHeader, bin]);
    },
  };

  return api;
}
