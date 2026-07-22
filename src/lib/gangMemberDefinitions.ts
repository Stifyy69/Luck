import type { GangMemberRarity, GangMemberSkill } from './gangMembers';

export type GangSkillDefinition = {
  label: string;
  role: string;
  description: string;
  systems: string[];
};

export const GANG_SKILL_DEFINITIONS: Record<GangMemberSkill, GangSkillDefinition> = {
  shooting: {
    label: 'Shooting',
    role: 'Shooter',
    description: 'Improves direct combat power in Firefight and Final Push.',
    systems: ['Battles'],
  },
  farming: {
    label: 'Farming',
    role: 'Farmer',
    description: 'Improves Leaves collection and resource-work progression.',
    systems: ['Leaves', 'Diver Miner'],
  },
  tactics: {
    label: 'Tactics',
    role: 'Strategist',
    description: 'Improves battle positioning and reduces injury and operation risk.',
    systems: ['Battles', 'Processing'],
  },
  recruiting: {
    label: 'Recruiting',
    role: 'Recruiter',
    description: 'Improves the quality and rarity of recruitment candidates.',
    systems: ['Recruitment'],
  },
  leadership: {
    label: 'Leadership',
    role: 'Leader',
    description: 'Improves crew coordination, Farming output and Final Push.',
    systems: ['Leaves', 'Battles'],
  },
  streetSmart: {
    label: 'Street Smart',
    role: 'Street Fixer',
    description: 'Reduces street-operation risk and helps detect dangerous situations.',
    systems: ['Transport', 'Battles'],
  },
};

export const GANG_RARITY_ORDER: Record<GangMemberRarity, number> = {
  COMMON: 1,
  RARE: 2,
  EPIC: 3,
  LEGENDARY: 4,
  MYTHIC: 5,
};
