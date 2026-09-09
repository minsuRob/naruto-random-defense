// Learn more: https://docs.expo.dev/versions/v57.0.0/config/metro/
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// 3D model / texture assets used by the game (see tools/w3x pipeline).
config.resolver.assetExts.push('glb', 'gltf', 'hdr', 'bin');

// three ships .mjs/.cjs entrypoints.
config.resolver.sourceExts.push('mjs', 'cjs');

module.exports = config;
