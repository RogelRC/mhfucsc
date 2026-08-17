#!/usr/bin/env node
/**
 * Extract MHFU game data from Athena's ASS CSV/TXT files into JSON format
 * for the mhfucsc web app.
 *
 * Usage:
 *   node scripts/extract-data.mjs [data-dir] [output-dir]
 *
 * Defaults:
 *   data-dir   = /tmp/mhfu-data
 *   output-dir = src/mhfu_json
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dataDir = process.argv[2] || '/tmp/mhfu-data';
const outDir = process.argv[3] || join(import.meta.dirname, '..', 'src', 'mhfu_json');

console.log(`Reading data from: ${dataDir}`);
console.log(`Writing output to: ${outDir}`);

// ---------------------------------------------------------------------------
// CSV parser (handles quoted fields with commas inside)
// ---------------------------------------------------------------------------

function parseCSVLine(line) {
	const fields = [];
	let i = 0;
	while (i < line.length) {
		if (line[i] === '"') {
			// quoted field
			let j = i + 1;
			while (j < line.length) {
				if (line[j] === '"') {
					if (j + 1 < line.length && line[j + 1] === '"') {
						j += 2; // escaped quote
					} else {
						break;
					}
				} else {
					j++;
				}
			}
			fields.push(line.slice(i + 1, j).replace(/""/g, '"'));
			i = j + 2; // skip closing quote and comma (or end)
		} else {
			// unquoted field
			let j = line.indexOf(',', i);
			if (j === -1) j = line.length;
			fields.push(line.slice(i, j));
			i = j + 1;
		}
	}
	return fields;
}

// ---------------------------------------------------------------------------
// Skills extraction
// ---------------------------------------------------------------------------

function extractSkills() {
	const raw = readFileSync(join(dataDir, 'skills.txt'), 'utf-8');
	const lines = raw.split(/\r?\n/);

	const abilities = []; // skill trees
	const skills = []; // individual skills
	const tags = new Set();

	let current = null;

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed === '') {
			if (current) {
				abilities.push(current);
				current = null;
			}
			continue;
		}

		// Check if it's an ability name (quoted string)
		const abilityMatch = trimmed.match(/^"([^"]+)"$/);
		if (abilityMatch) {
			if (current) {
				abilities.push(current);
			}
			current = {
				name: abilityMatch[1],
				tags: [],
				skills: []
			};
			continue;
		}

		if (!current) continue;

		// Check for tag
		const tagMatch = trimmed.match(/^tag="([^"]+)"$/);
		if (tagMatch) {
			current.tags.push(tagMatch[1]);
			tags.add(tagMatch[1]);
			continue;
		}

		// Check for skill line: points "name"
		const skillMatch = trimmed.match(/^(-?\d+)\s+"([^"]+)"$/);
		if (skillMatch) {
			const points = parseInt(skillMatch[1], 10);
			const name = skillMatch[2];
			current.skills.push({ name, points });
			skills.push({
				name,
				skillTree: current.name,
				points,
				tag: current.tags[0] || null
			});
		}
	}

	// Push last ability
	if (current) {
		abilities.push(current);
	}

	// Build skill_trees.json
	const skillTrees = abilities.map((a) => ({
		name: a.name,
		skills: a.skills.sort((a, b) => a.points - b.points)
	}));

	// Build skills.json (flat list)
	const skillsJson = skills.sort(
		(a, b) => a.skillTree.localeCompare(b.skillTree) || a.points - b.points
	);

	// Build tags.json
	const tagsJson = [...tags].sort();

	writeFileSync(join(outDir, 'skill_trees.json'), JSON.stringify(skillTrees, null, '\t'));
	writeFileSync(join(outDir, 'skills.json'), JSON.stringify(skillsJson, null, '\t'));
	writeFileSync(join(outDir, 'tags.json'), JSON.stringify(tagsJson, null, '\t'));

	console.log(`  skills.json: ${skillsJson.length} skills`);
	console.log(`  skill_trees.json: ${skillTrees.length} trees`);
	console.log(`  tags.json: ${tagsJson.length} tags`);

	return { abilities, skills, tags };
}

// ---------------------------------------------------------------------------
// Armor extraction
// ---------------------------------------------------------------------------

function parseHRField(field) {
	// Fields like "1", "3", "10", "7!", "5!" etc.
	// The ! indicates elder-star exclusive requirement
	const cleaned = field.replace(/!/g, '').replace(/"/g, '').trim();
	if (cleaned === '' || cleaned === '0') return { hr: 0, special: false };
	const num = parseInt(cleaned, 10);
	return { hr: isNaN(num) ? 0 : num, special: field.includes('!') };
}

function parseSlots(field) {
	// Fields like "---", "O--", "OO-", "OOO"
	const cleaned = field.replace(/"/g, '').trim();
	let count = 0;
	for (const c of cleaned) {
		if (c === 'O') count++;
	}
	return count;
}

function parseGender(field) {
	const cleaned = field.replace(/"/g, '').trim();
	if (cleaned.includes('Male') && cleaned.includes('Female')) return 'Both';
	if (cleaned === 'Male') return 'Male';
	if (cleaned === 'Female') return 'Female';
	return 'Both';
}

function parseHunterType(field) {
	const cleaned = field.replace(/"/g, '').trim();
	if (cleaned.includes('Blade') && cleaned.includes('Gunner')) return 'Both';
	if (cleaned === 'Blade') return 'Blademaster';
	if (cleaned === 'Gunner') return 'Gunner';
	return 'Both';
}

function extractArmors() {
	const partFiles = [
		{ file: 'head.csv', part: 'Head' },
		{ file: 'body.csv', part: 'Body' },
		{ file: 'arms.csv', part: 'Arms' },
		{ file: 'waist.csv', part: 'Waist' },
		{ file: 'legs.csv', part: 'Legs' }
	];

	const armors = [];
	const seen = new Set();

	for (const { file, part } of partFiles) {
		const raw = readFileSync(join(dataDir, file), 'utf-8');
		const lines = raw.split(/\r?\n/);

		// Skip header line (line 0) and empty line (line 1)
		for (let i = 2; i < lines.length; i++) {
			const line = lines[i].trim();
			if (line === '') continue;

			const f = parseCSVLine(line);
			if (f.length < 23) continue;

			const name = f[0].replace(/"/g, '').trim();
			if (!name || name === '') continue;

			// Skip dummy armors
			if (name.includes('(dummy)')) continue;

			// Deduplicate by name + gender
			const gender = parseGender(f[16]);
			const dedupKey = `${name}|${gender}`;
			if (seen.has(dedupKey)) continue;
			seen.add(dedupKey);

			const defense = parseInt(f[10], 10) || 0;
			const fireRes = parseInt(f[11], 10) || 0;
			const thunderRes = parseInt(f[12], 10) || 0;
			const dragonRes = parseInt(f[13], 10) || 0;
			const waterRes = parseInt(f[14], 10) || 0;
			const iceRes = parseInt(f[15], 10) || 0;
			const rarity = parseInt(f[18], 10) || 1;

			const hrInfo = parseHRField(f[19]);
			const elderInfo = parseHRField(f[20]);

			const slots = parseSlots(f[21]);
			const hunterType = parseHunterType(f[17]);

			// Parse skills (up to 5 pairs)
			const skills = [];
			for (let s = 0; s < 5; s++) {
				const skillIdx = 22 + s * 2;
				const pointIdx = skillIdx + 1;
				if (skillIdx < f.length && pointIdx < f.length) {
					const skillName = f[skillIdx].replace(/"/g, '').trim();
					const points = parseInt(f[pointIdx], 10) || 0;
					if (skillName && skillName !== '') {
						skills.push({ skillTree: skillName, points });
					}
				}
			}

			// Parse materials (up to 4 pairs)
			const materials = [];
			for (let m = 0; m < 4; m++) {
				const matIdx = 2 + m * 2;
				const amtIdx = matIdx + 1;
				if (matIdx < f.length && amtIdx < f.length) {
					const matName = f[matIdx].replace(/"/g, '').trim();
					const amt = parseInt(f[amtIdx], 10) || 0;
					if (matName && matName !== '' && amt > 0) {
						materials.push({ name: matName, quantity: amt });
					}
				}
			}

			// Convert HR/ElderStar to our format
			// In FU: hr = hunter rank available, elderStar = village progress
			// We store both as separate fields
			const hrRequired = hrInfo.hr;
			const elderStarRequired = elderInfo.hr;

			// Check if this is a "Torso Inc" piece
			const isTorsoInc = skills.some((s) => s.skillTree === 'Torso Inc');

			armors.push({
				name,
				part,
				gender,
				hunterType,
				rarity,
				slots,
				hrRequired,
				elderStarRequired,
				defenseBase: defense,
				defenseMax: defense, // FU doesn't have upgrade system like MHP3rd
				resistances: {
					fire: fireRes,
					water: waterRes,
					ice: iceRes,
					thunder: thunderRes,
					dragon: dragonRes
				},
				skills,
				materials,
				isTorsoInc
			});
		}
	}

	writeFileSync(join(outDir, 'armors.json'), JSON.stringify(armors, null, '\t'));
	console.log(`  armors.json: ${armors.length} pieces`);

	return armors;
}

// ---------------------------------------------------------------------------
// Decorations extraction
// ---------------------------------------------------------------------------

function extractDecorations() {
	const raw = readFileSync(join(dataDir, 'decorations.csv'), 'utf-8');
	const lines = raw.split(/\r?\n/);

	const decorations = [];

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed === '') continue;

		const f = parseCSVLine(trimmed);
		if (f.length < 9) continue;

		const name = f[0].replace(/"/g, '').trim();
		if (!name || name === '') continue;

		const slots = parseSlots(f[2]);
		const hrInfo = parseHRField(f[3]);
		const elderInfo = parseHRField(f[4]);

		// Parse skills (2 pairs)
		const skills = [];
		for (let s = 0; s < 2; s++) {
			const pointIdx = 5 + s * 2;
			const skillIdx = pointIdx + 1;
			if (pointIdx < f.length && skillIdx < f.length) {
				const pointsStr = f[pointIdx].replace(/"/g, '').trim();
				const skillName = f[skillIdx].replace(/"/g, '').trim();
				if (pointsStr && skillName) {
					// Handle special values like "7!" or "5!"
					const points = parseInt(pointsStr.replace(/!/g, ''), 10) || 0;
					if (skillName !== '') {
						skills.push({ skillTree: skillName, points });
					}
				}
			}
		}

		// Parse materials (up to 8 pairs, each recipe is a separate array)
		// Format: Mat1Name, Amt1, Mat2Name, Amt2, ... (up to 8 materials per recipe)
		// But we only store the first recipe for simplicity
		const recipes = [];
		const recipe = [];
		for (let m = 0; m < 8; m++) {
			const amtIdx = 9 + m * 2;
			const matIdx = amtIdx + 1;
			if (amtIdx < f.length && matIdx < f.length) {
				const amt = parseInt(f[amtIdx], 10) || 0;
				const matName = f[matIdx].replace(/"/g, '').trim();
				if (matName && matName !== '' && amt > 0) {
					recipe.push({ name: matName, quantity: amt });
				}
			}
		}
		if (recipe.length > 0) {
			recipes.push(recipe);
		}

		decorations.push({
			name,
			rarity: 4, // Default rarity for decorations
			slots,
			hrRequired: hrInfo.hr,
			elderStarRequired: elderInfo.hr,
			skills,
			recipes
		});
	}

	writeFileSync(join(outDir, 'decorations.json'), JSON.stringify(decorations, null, '\t'));
	console.log(`  decorations.json: ${decorations.length} decorations`);

	return decorations;
}

// ---------------------------------------------------------------------------
// Components (materials) extraction - for reference
// ---------------------------------------------------------------------------

function extractComponents() {
	const raw = readFileSync(join(dataDir, 'components.txt'), 'utf-8');
	const lines = raw.split(/\r?\n/);

	const components = [];

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed === '' || trimmed.startsWith(';')) continue;

		// Each line is just a material name
		if (trimmed) {
			components.push({ name: trimmed });
		}
	}

	writeFileSync(join(outDir, 'components.json'), JSON.stringify(components, null, '\t'));
	console.log(`  components.json: ${components.length} materials`);

	return components;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log('\nExtracting MHFU game data...\n');

extractSkills();
extractArmors();
extractDecorations();
extractComponents();

console.log('\nDone!');
