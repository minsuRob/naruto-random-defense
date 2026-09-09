/**
 * MDX skeleton and animation -> glTF skin and clips.
 *
 * Warcraft stores bones as a flat list with parent ids and a separate array of
 * pivot points (each bone's origin in model space). Animation tracks hold
 * offsets *from* that pivot, so a node's local transform is
 *
 *   translation = (pivot - parentPivot) + KGTR value
 *   rotation    = KGRT value            (already x, y, z, w)
 *   scale       = KGSC value
 *
 * Nothing here converts axes or scales: the whole skeleton stays in raw MDX
 * space and the exporter parents it under one root node that does the Z-up to
 * Y-up rotation. Keeping the conversion in a single node avoids having to
 * rotate every quaternion, and the inverse bind matrices stay trivial.
 */

/** Clips worth shipping, and what the game calls them. */
export const WANTED_SEQUENCES = [
  { clip: 'stand', match: /^stand(\s|$)/i },
  { clip: 'walk', match: /^walk(\s|$)/i },
  { clip: 'attack', match: /^attack/i },
  { clip: 'death', match: /^death(\s|$)/i },
];

/** Warcraft's "Alternate" variants are second-form animations; prefer the base. */
function pickSequence(sequences, match) {
  const candidates = sequences.filter((s) => match.test(s.name));
  if (!candidates.length) return null;
  const plain = candidates.filter((s) => !/alternate/i.test(s.name));
  return (plain.length ? plain : candidates)[0];
}

export function selectSequences(model) {
  const out = [];
  for (const wanted of WANTED_SEQUENCES) {
    const sequence = pickSequence(model.sequences, wanted.match);
    if (sequence) out.push({ clip: wanted.clip, sequence });
  }
  return out;
}

/**
 * Bones and helpers together form the node hierarchy; object ids are unique
 * across both and index into pivotPoints.
 */
export function collectJoints(model) {
  const objects = [...model.bones, ...model.helpers];
  objects.sort((a, b) => a.objectId - b.objectId);

  const indexById = new Map();
  objects.forEach((object, index) => indexById.set(object.objectId, index));

  const joints = objects.map((object) => {
    const pivot = model.pivotPoints[object.objectId] ?? [0, 0, 0];
    const parentPivot =
      object.parentId >= 0 ? (model.pivotPoints[object.parentId] ?? [0, 0, 0]) : [0, 0, 0];
    return {
      object,
      name: object.name,
      objectId: object.objectId,
      parentIndex: object.parentId >= 0 ? (indexById.get(object.parentId) ?? -1) : -1,
      pivot: [pivot[0], pivot[1], pivot[2]],
      // Bind local translation: how far this bone sits from its parent.
      bindTranslation: [
        pivot[0] - parentPivot[0],
        pivot[1] - parentPivot[1],
        pivot[2] - parentPivot[2],
      ],
    };
  });

  return { joints, indexById };
}

/**
 * Inverse bind matrices. Bind rotations are identity in MDX, so a joint's
 * global bind transform is just a translation to its pivot and the inverse is
 * a translation back.
 */
export function inverseBindMatrices(joints) {
  const out = new Float32Array(joints.length * 16);
  joints.forEach((joint, i) => {
    const o = i * 16;
    out[o] = 1;
    out[o + 5] = 1;
    out[o + 10] = 1;
    out[o + 15] = 1;
    out[o + 12] = -joint.pivot[0];
    out[o + 13] = -joint.pivot[1];
    out[o + 14] = -joint.pivot[2];
  });
  return out;
}

/**
 * Per-vertex bone bindings.
 *
 * MDX groups vertices: `vertexGroups[v]` picks a group, `matrixGroups[g]` says
 * how many bones that group uses, and `matrixIndices` is the flat concatenation
 * of those bone object ids. Every bone in a group carries equal weight.
 *
 * glTF takes four influences per vertex, so oversized groups keep the first four.
 */
export function skinAttributes(geoset, indexById) {
  const vertexCount = geoset.vertices.length / 3;
  const joints = new Uint16Array(vertexCount * 4);
  const weights = new Float32Array(vertexCount * 4);

  // Group g starts at this offset into matrixIndices.
  const groupOffsets = new Uint32Array(geoset.matrixGroups.length);
  let offset = 0;
  for (let g = 0; g < geoset.matrixGroups.length; g++) {
    groupOffsets[g] = offset;
    offset += geoset.matrixGroups[g];
  }

  let skipped = 0;
  for (let v = 0; v < vertexCount; v++) {
    const group = geoset.vertexGroups[v];
    const size = geoset.matrixGroups[group] ?? 0;
    if (!size) {
      // No binding: pin to the first joint so the vertex still follows the model.
      weights[v * 4] = 1;
      skipped++;
      continue;
    }

    const used = Math.min(size, 4);
    const weight = 1 / used;
    for (let i = 0; i < used; i++) {
      const objectId = geoset.matrixIndices[groupOffsets[group] + i];
      joints[v * 4 + i] = indexById.get(objectId) ?? 0;
      weights[v * 4 + i] = weight;
    }
  }

  return { joints, weights, skipped };
}

/** MDX interpolation types: 0 none, 1 linear, 2 hermite, 3 bezier. */
function interpolationFor(type) {
  return type === 0 ? 'STEP' : 'LINEAR';
}

function trackOf(object, name) {
  return object.animations?.find((a) => a.name === name && a.globalSequenceId < 0) ?? null;
}

/**
 * Sample one track over a sequence's interval.
 *
 * Warcraft keyframes are absolute milliseconds across the whole model, so a
 * clip is the slice inside its interval, re-based to zero. Sequences whose
 * keys fall outside the interval still need endpoints, so the value in effect
 * at the start and end is carried in.
 */
function sliceTrack(track, interval, defaultValue) {
  if (!track || !track.frames.length) return null;
  const [start, end] = interval;
  const size = defaultValue.length;

  const times = [];
  const values = [];

  const valueAt = (index) => {
    const value = track.values[index];
    return Array.from(value.length === size ? value : defaultValue);
  };

  // Value in effect at the start: the last key at or before it.
  let before = -1;
  for (let i = 0; i < track.frames.length; i++) {
    if (track.frames[i] <= start) before = i;
  }
  if (before >= 0) {
    times.push(0);
    values.push(...valueAt(before));
  }

  for (let i = 0; i < track.frames.length; i++) {
    const frame = track.frames[i];
    if (frame <= start || frame > end) continue;
    times.push((frame - start) / 1000);
    values.push(...valueAt(i));
  }

  if (!times.length) return null;
  // A single key is a constant pose; give it a second endpoint so players loop.
  if (times.length === 1) {
    times.push((end - start) / 1000);
    values.push(...values.slice(0, size));
  }

  return {
    times: Float32Array.from(times),
    values: Float32Array.from(values),
    interpolation: interpolationFor(track.interpolationType),
  };
}

/**
 * Build the animation channels for one sequence.
 * `nodeIndexOf(jointIndex)` maps a joint to its glTF node.
 */
export function buildChannels(joints, sequence, nodeIndexOf) {
  const channels = [];
  const [start, end] = sequence.interval;
  if (end <= start) return channels;

  joints.forEach((joint, index) => {
    const node = nodeIndexOf(index);

    const translation = sliceTrack(trackOf(joint.object, 'KGTR'), sequence.interval, [0, 0, 0]);
    if (translation) {
      // Track values are offsets from the pivot; glTF wants the full local one.
      const values = Float32Array.from(translation.values);
      for (let i = 0; i < values.length; i += 3) {
        values[i] += joint.bindTranslation[0];
        values[i + 1] += joint.bindTranslation[1];
        values[i + 2] += joint.bindTranslation[2];
      }
      channels.push({ node, path: 'translation', ...translation, values });
    }

    const rotation = sliceTrack(trackOf(joint.object, 'KGRT'), sequence.interval, [0, 0, 0, 1]);
    if (rotation) channels.push({ node, path: 'rotation', ...rotation });

    const scale = sliceTrack(trackOf(joint.object, 'KGSC'), sequence.interval, [1, 1, 1]);
    if (scale) channels.push({ node, path: 'scale', ...scale });
  });

  return channels;
}
