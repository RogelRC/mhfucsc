import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const jsonDir = resolve(__dirname, '../src/mhfu_json');

function loadJson(name) {
  return JSON.parse(readFileSync(resolve(jsonDir, name), 'utf8'));
}
function saveJson(name, data) {
  writeFileSync(resolve(jsonDir, name), JSON.stringify(data, null, '\t') + '\n');
}

// ── 1. Rename skill trees ──────────────────────────────────────────────
const TREE_RENAMES = {
  'Technique': 'Constitutn',
  'Fast Chrge': 'Focus',
  'BombStrUp': 'Bomber',
  'Flyne Atk': 'Felyne Atk',
  'Flyne Def': 'Felyne Def',
  'FlyneGuide': 'ComrdGuide',
  'Drawn Crit': 'Sword Draw',
};

function renameTree(obj, key = 'skillTree') {
  if (obj[key] && TREE_RENAMES[obj[key]]) obj[key] = TREE_RENAMES[obj[key]];
}

// ── 2. Fix skill names ─────────────────────────────────────────────────
const SKILL_NAME_FIXES = {
  // Focus tree (renamed from Fast Chrge)
  'Concentration': { newName: 'Focus', tree: 'Focus' },
  'Distraction': { newName: 'Distracted', tree: 'Focus' },
  // Sword Draw tree (renamed from Drawn Crit)
  'Unsheathed Atk Crit': { newName: 'Art of Unsheathing', tree: 'Sword Draw' },
  // Constitution tree (renamed from Technique)
  'Defensive Maneuvers -2': { newName: 'Constitution -2', tree: 'Constitutn' },
  'Defensive Maneuvers -1': { newName: 'Constitution -1', tree: 'Constitutn' },
  'Defensive Maneuvers +1': { newName: 'Constitution +1', tree: 'Constitutn' },
  'Defensive Maneuvers +2': { newName: 'Constitution +2', tree: 'Constitutn' },
};

// ── 3. New skills to add ───────────────────────────────────────────────
const NEW_SKILLS = [
  { name: 'Guts', skillTree: 'Guts', points: 10, tag: 'Defensive' },
  { name: 'Art of Unsheathing', skillTree: 'Sword Draw', points: 10, tag: 'Blademaster' },
  { name: 'Stellar Hunter', skillTree: 'Edge Master', points: 10, tag: 'Offensive' },
  { name: 'Comrade Guidance', skillTree: 'ComrdGuide', points: 10, tag: null },
  { name: 'Comrade Guidance & Trade', skillTree: 'ComrdGuide', points: 15, tag: null },
  { name: 'Comrade Attack', skillTree: 'ComrdAttack', points: 10, tag: null },
  { name: 'Comrade Defence', skillTree: 'ComrdDef', points: 10, tag: null },
];

// ── 4. New skill trees ─────────────────────────────────────────────────
const NEW_TREES = [
  { name: 'Guts', skills: [{ name: 'Guts', points: 10 }] },
  { name: 'Sword Draw', skills: [{ name: 'Art of Unsheathing', points: 10 }] },
  { name: 'Edge Master', skills: [{ name: 'Stellar Hunter', points: 10 }] },
  { name: 'ComrdGuide', skills: [
    { name: 'Comrade Guidance', points: 10 },
    { name: 'Comrade Guidance & Trade', points: 15 },
  ]},
  { name: 'ComrdAttack', skills: [{ name: 'Comrade Attack', points: 10 }] },
  { name: 'ComrdDef', skills: [{ name: 'Comrade Defence', points: 10 }] },
];

// ── Process skills.json ────────────────────────────────────────────────
console.log('Fixing skills.json...');
let skills = loadJson('skills.json');
let changed = 0;

// Rename trees and skill names
for (const s of skills) {
  renameTree(s);
  const fix = SKILL_NAME_FIXES[s.name];
  if (fix) {
    s.name = fix.newName;
    s.skillTree = fix.tree;
    changed++;
  }
}

// Remove old Drawn Crit / Unsheathed Atk Crit (replaced by Sword Draw / Art of Unsheathing)
skills = skills.filter(s => !(s.skillTree === 'Sword Draw' && s.name === 'Art of Unsheathing'));

// Add new skills
for (const ns of NEW_SKILLS) {
  // Avoid duplicates
  if (!skills.some(s => s.name === ns.name && s.skillTree === ns.skillTree)) {
    skills.push(ns);
    changed++;
  }
}

// Sort alphabetically by skillTree then by points
skills.sort((a, b) => a.skillTree.localeCompare(b.skillTree) || a.points - b.points);
saveJson('skills.json', skills);
console.log(`  -> ${skills.length} skills (${changed} changes/adds)`);

// ── Process skill_trees.json ───────────────────────────────────────────
console.log('Fixing skill_trees.json...');
let trees = loadJson('skill_trees.json');

// Rename trees
for (const t of trees) {
  if (TREE_RENAMES[t.name]) t.name = TREE_RENAMES[t.name];
}

// Fix skill names inside trees
for (const t of trees) {
  for (const sk of t.skills) {
    const fix = SKILL_NAME_FIXES[sk.name];
    if (fix) {
      sk.name = fix.newName;
    }
  }
}

// Remove the old Sword Draw tree that had Unsheathed Atk Crit
trees = trees.filter(t => !(t.name === 'Sword Draw' && t.skills.some(s => s.name === 'Art of Unsheathing')));

// Add new trees (skip existing)
for (const nt of NEW_TREES) {
  if (!trees.some(t => t.name === nt.name)) {
    trees.push(nt);
  }
}

// Sort alphabetically
trees.sort((a, b) => a.name.localeCompare(b.name));
saveJson('skill_trees.json', trees);
console.log(`  -> ${trees.length} trees`);

// ── Process armors.json ────────────────────────────────────────────────
console.log('Fixing armors.json...');
let armors = loadJson('armors.json');
let armorChanges = 0;

for (const a of armors) {
  // Rename trees
  const oldTree = a.skillTree;
  renameTree(a);
  if (a.skillTree !== oldTree) armorChanges++;

  // Fix skill names
  for (const sk of a.skills) {
    const oldSkTree = sk.skillTree;
    renameTree(sk);
    if (sk.skillTree !== oldSkTree) armorChanges++;
  }

  // Fix elderStarRequired: cap at 9
  if (a.elderStarRequired > 9) {
    a.elderStarRequired = 9;
    armorChanges++;
  }
}

saveJson('armors.json', armors);
console.log(`  -> ${armors.length} armors (${armorChanges} changes)`);

// ── Process decorations.json ───────────────────────────────────────────
console.log('Fixing decorations.json...');
let decos = loadJson('decorations.json');
let decoChanges = 0;

for (const d of decos) {
  // Rename trees in decoration skills
  for (const sk of d.skills) {
    const oldTree = sk.skillTree;
    renameTree(sk);
    if (sk.skillTree !== oldTree) decoChanges++;
  }

  // Fix elderStarRequired: cap at 9
  if (d.elderStarRequired > 9) {
    d.elderStarRequired = 9;
    decoChanges++;
  }
}

saveJson('decorations.json', decos);
console.log(`  -> ${decos.length} decorations (${decoChanges} changes)`);

// ── Fix summary.json ──────────────────────────────────────────────────
console.log('Fixing summary.json...');
let summary = loadJson('summary.json');
summary.meta.game = 'Monster Hunter Freedom Unite';
summary.counts.skills = skills.length;
summary.counts.skillTrees = trees.length;
saveJson('summary.json', summary);
console.log(`  -> game: ${summary.meta.game}`);

console.log('\nDone! All MHFU skill data corrected.');
