export type ArmorPart = 'Head' | 'Body' | 'Arms' | 'Waist' | 'Legs';

export interface SkillEntry {
	name: string;
	skillTree: string;
	points: number | null;
	hunterType?: string;
	tag?: string;
	order?: number;
}

export interface SkillTreeSkill {
	name: string;
	points: number;
}

export interface SkillTree {
	name: string;
	skills: SkillTreeSkill[];
}

export interface ArmorPiece {
	name: string;
	part: ArmorPart;
	gender: 'Both' | 'Male' | 'Female';
	hunterType: 'Both' | 'Blademaster' | 'Gunner';
	rarity: number;
	slots: number;
	hrRequired: number;
	elderStarRequired: number;
	defenseBase: number;
	defenseMax: number;
	resistances: { fire: number; water: number; ice: number; thunder: number; dragon: number };
	skills: { skillTree: string; points: number }[];
	materials: { name: string; quantity: number }[];
	isTorsoInc: boolean;
}

export interface Decoration {
	name: string;
	rarity: number;
	slots: number;
	hrRequired: number;
	elderStarRequired: number;
	skills: { skillTree: string; points: number }[];
	recipes: { name: string; quantity: number }[][];
}

export interface SearchSettings {
	weaponSlots: number;
	gender: 'Any' | 'Male' | 'Female';
	hunterType: 'Blademaster' | 'Gunner';
	maxRarity: number | null;
	maxHr: number | null;
	maxElderStars: number | null;
}

export interface SkillTarget {
	name: string;
	tree: string;
	points: number;
}

export interface DecorUse {
	name: string;
	count: number;
}

export interface SetPiece {
	name: string;
	part: ArmorPart;
	slots: number;
	defenseBase: number;
	defenseMax: number;
	rarity: number;
	hrRequired: number;
	elderStarRequired: number;
	isTorsoInc: boolean;
	materials: { name: string; quantity: number }[];
}

export interface ActivatedSkill {
	name: string;
	tree: string;
	points: number;
}

export interface SetResult {
	pieces: SetPiece[];
	weaponSlots: number;
	decorations: DecorUse[];
	usedSlots: number;
	totalSlots: number;
	treePoints: { tree: string; points: number }[];
	activated: ActivatedSkill[];
	negativeActivated: ActivatedSkill[];
	defenseSumMax: number;
	defenseSumBase: number;
	resistanceSum: { fire: number; water: number; ice: number; thunder: number; dragon: number };
	raritySum: number;
	hrSum: number;
	slotsLeft: number;
	allTargetsMet: boolean;
}

export interface SearchProgress {
	phase: string;
	nodes: number;
	found: number;
	done: boolean;
	aborted?: boolean;
}
