/**
 * Minimal binary glTF (.glb) writer for static, textured meshes.
 *
 * Writing this directly rather than going through three's GLTFExporter keeps the
 * pipeline free of a browser DOM in node (the exporter reaches for Blob and
 * FileReader when it embeds images).
 */

const COMPONENT = { UNSIGNED_INT: 5125, FLOAT: 5126 };
const TARGET = { ARRAY_BUFFER: 34962, ELEMENT_ARRAY_BUFFER: 34963 };

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

  function addBufferView(data, target) {
    const padded = align4(byteLength) - byteLength;
    if (padded) {
      buffers.push(Buffer.alloc(padded));
      byteLength += padded;
    }
    const bytes = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    const view = { buffer: 0, byteOffset: byteLength, byteLength: bytes.length };
    if (target) view.target = target;
    buffers.push(bytes);
    byteLength += bytes.length;
    bufferViews.push(view);
    return bufferViews.length - 1;
  }

  function addAccessor(data, type, componentType, count, target, minMax) {
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

  function boundsOf(positions) {
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

  return {
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

    /** primitives: [{ positions, normals, uvs, indices, material }] */
    addMesh(name, primitives) {
      const meshPrimitives = primitives.map((p) => {
        const attributes = {
          POSITION: addAccessor(
            p.positions,
            'VEC3',
            COMPONENT.FLOAT,
            p.positions.length / 3,
            TARGET.ARRAY_BUFFER,
            boundsOf(p.positions)
          ),
        };
        if (p.normals) {
          attributes.NORMAL = addAccessor(
            p.normals,
            'VEC3',
            COMPONENT.FLOAT,
            p.normals.length / 3,
            TARGET.ARRAY_BUFFER
          );
        }
        if (p.uvs) {
          attributes.TEXCOORD_0 = addAccessor(
            p.uvs,
            'VEC2',
            COMPONENT.FLOAT,
            p.uvs.length / 2,
            TARGET.ARRAY_BUFFER
          );
        }
        return {
          attributes,
          indices: addAccessor(
            p.indices,
            'SCALAR',
            COMPONENT.UNSIGNED_INT,
            p.indices.length,
            TARGET.ELEMENT_ARRAY_BUFFER
          ),
          material: p.material,
        };
      });
      meshes.push({ name, primitives: meshPrimitives });
      nodes.push({ mesh: meshes.length - 1, name });
      return meshes.length - 1;
    },

    build({ generator = 'nrd tools/w3x/mdx2glb' } = {}) {
      const usedExtensions = materials.some((m) => m.extensions?.KHR_materials_unlit)
        ? ['KHR_materials_unlit']
        : undefined;

      const gltf = {
        asset: { version: '2.0', generator },
        extensionsUsed: usedExtensions,
        scene: 0,
        scenes: [{ nodes: nodes.map((_, i) => i) }],
        nodes,
        meshes,
        materials,
        accessors,
        bufferViews,
        buffers: [{ byteLength }],
      };
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
}
