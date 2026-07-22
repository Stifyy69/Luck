import test from 'node:test';
import assert from 'node:assert/strict';
import { filterGangMembers } from '../src/lib/gangMemberFilters.ts';
import type { GangMember } from '../src/types/gang.ts';

const base = { status: 'Available', xp: 0, xpNeeded: 100, bonuses: [], lastWork: 'collect', fatigue: { activity: 'collect', count: 1 }, injuryUntil: undefined } as const;
const members: GangMember[] = [
  { ...base, id: '1', firstName: 'Ana', lastName: 'Pop', nickname: 'Ghost', displayName: 'Ana Ghost Pop', rarity: 'Mythic', role: 'Shooter', level: 20, loyalty: 35, skills: { shooting: 90, tactics: 50, leadership: 30, streetSmart: 40, farming: 10, recruiting: 5 }, joinedAt: '2026-02-01T00:00:00Z' },
  { ...base, id: '2', firstName: 'Mihai', lastName: 'Stan', nickname: 'Crop', displayName: 'Mihai Crop Stan', rarity: 'Rare', role: 'Farmer', level: 10, loyalty: 80, skills: { shooting: 20, tactics: 30, leadership: 40, streetSmart: 50, farming: 95, recruiting: 20 }, joinedAt: '2026-01-01T00:00:00Z' },
  { ...base, id: '3', firstName: 'Ioana', lastName: 'Lup', nickname: 'Boss', displayName: 'Ioana Boss Lup', rarity: 'Epic', role: 'Leader', status: 'Injured', level: 15, loyalty: 60, skills: { shooting: 60, tactics: 70, leadership: 98, streetSmart: 65, farming: 30, recruiting: 40 }, joinedAt: '2026-03-01T00:00:00Z' },
];

const filters = { search: '', rarity: 'All', status: 'All', role: 'All', loyalty: 'All', sort: 'level-desc' } as const;

test('member search covers first, nickname, last and display names', () => {
  for (const [search, id] of [['mihai', '2'], ['ghost', '1'], ['pop', '1'], ['ana ghost pop', '1']]) {
    assert.deepEqual(filterGangMembers(members, { ...filters, search }).map((member) => member.id), [id]);
  }
});

test('rarity, status, role and loyalty filters combine without mutating members', () => {
  const original = structuredClone(members);
  assert.deepEqual(filterGangMembers(members, { ...filters, rarity: 'Epic', status: 'Injured', role: 'Leader', loyalty: 'Medium' }).map((member) => member.id), ['3']);
  assert.deepEqual(members, original);
});

test('member sorting supports level, rarity, loyalty, skills and joined date', () => {
  assert.deepEqual(filterGangMembers(members, { ...filters, sort: 'level-asc' }).map((member) => member.id), ['2', '3', '1']);
  assert.deepEqual(filterGangMembers(members, { ...filters, sort: 'rarity-desc' }).map((member) => member.id), ['1', '3', '2']);
  assert.deepEqual(filterGangMembers(members, { ...filters, sort: 'loyalty-desc' }).map((member) => member.id), ['2', '3', '1']);
  assert.deepEqual(filterGangMembers(members, { ...filters, sort: 'farming-desc' }).map((member) => member.id), ['2', '3', '1']);
  assert.deepEqual(filterGangMembers(members, { ...filters, sort: 'newest' }).map((member) => member.id), ['3', '1', '2']);
});
