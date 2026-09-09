import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);

/**
 * Shared helpers for the extraction scripts.
 *
 * The source map is the user's own copy of the Warcraft 3 custom map; it is
 * never copied into the repo, and neither are its assets (see .gitignore).
 * These scripts read it and emit derived JSON / glb into out/ and
 * src/game/data/generated/.
 */

export const DEFAULT_MAP = path.join(homedir(), 'Downloads', 'nrd-seaon1-7.96_Ez.w3x');
export const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
export const OUT_DIR = path.join(ROOT, 'tools/w3x/out');
export const GENERATED_DIR = path.join(ROOT, 'src/game/data/generated');

export function parseArgs(argv = process.argv.slice(2)) {
  const args = { map: DEFAULT_MAP };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--map') args.map = argv[++i];
    else if (argv[i] === '--limit') args.limit = Number(argv[++i]);
    else if (argv[i].startsWith('--')) args[argv[i].slice(2)] = true;
  }
  return args;
}

/** Open the .w3x (an MPQ archive) and return the parsed map. */
export function openMap(mapPath = DEFAULT_MAP) {
  const War3Map = require('mdx-m3-viewer/dist/cjs/parsers/w3x/map').default;
  const buffer = readFileSync(mapPath);
  const map = new War3Map();
  map.load(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), true);
  return map;
}

export function readText(archive, name) {
  const entry = archive.get(name);
  if (!entry) return null;
  return new TextDecoder('utf-8').decode(entry.bytes());
}

export function readBytes(archive, name) {
  const entry = archive.get(name);
  return entry ? entry.bytes() : null;
}

/** Warcraft 3 colour codes: |cAARRGGBB ... |r */
export function stripColorCodes(s) {
  return String(s ?? '').replace(/\|c[0-9a-fA-F]{8}/g, '').replace(/\|r/g, '');
}

/** Grade tags the map embeds in unit names, e.g. "[히든] 시무라 단조". */
export const GRADE_BY_TAG = {
  노말: 'normal',
  매직: 'magic',
  레어: 'rare',
  유니크: 'unique',
  전설: 'legend',
  히든: 'hidden',
  인주력: 'jinchuriki',
  미수: 'bijuu',
  엘리트: 'elite',
  리미트: 'limit',
  에픽: 'epic',
  인피니티: 'infinity',
  창조: 'creation',
  스페셜: 'special',
  파멸: 'ruin',
};

/** Short tags used inside recipe strings, e.g. "[유]쿠레나이". */
export const GRADE_BY_SHORT_TAG = {
  노: 'normal',
  매: 'magic',
  레: 'rare',
  유: 'unique',
  전: 'legend',
  히: 'hidden',
  인: 'jinchuriki',
  미: 'bijuu',
  엘: 'elite',
  리: 'limit',
  에: 'epic',
  창: 'creation',
  스: 'special',
  파: 'ruin',
};

/** Split "[히든] 시무라 단조" into its grade and bare name. */
export function parseUnitName(rawName) {
  const clean = stripColorCodes(rawName).replace(/\s+/g, ' ').trim();
  const tagMatch = clean.match(/\[([^\]]+)\]/);
  const tag = tagMatch ? tagMatch[1].trim() : null;
  const name = clean.replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
  return { clean, tag, grade: tag ? (GRADE_BY_TAG[tag] ?? null) : null, name };
}

/** Stable ascii id from a Korean name plus the map's own object id. */
export function makeId(name, w3uId) {
  const slug = name
    .replace(/[^0-9A-Za-z가-힣]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${slug || 'unit'}__${w3uId}`;
}

export function writeJson(file, data) {
  const { writeFileSync, mkdirSync } = require('node:fs');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  return file;
}
