import type { GangMember } from './gangMembers';

export type GangActivityLogTone = 'positive' | 'negative' | 'warning' | 'neutral';

export type GangActivityLogEntry = {
  id: string;
  message: string;
  tone: GangActivityLogTone;
  createdAt: number;
};

export type WorkFatigueResult = {
  members: GangMember[];
  penalized: GangMember[];
};

function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createGangActivityLog(message: string, tone: GangActivityLogTone = 'neutral'): GangActivityLogEntry {
  return {
    id: makeId('gang_log'),
    message: String(message).slice(0, 220),
    tone,
    createdAt: Date.now(),
  };
}

export function prependGangActivityLog(
  current: GangActivityLogEntry[],
  message: string,
  tone: GangActivityLogTone = 'neutral',
) {
  return [createGangActivityLog(message, tone), ...current].slice(0, 50);
}

export function migrateGangActivityLog(value: unknown): GangActivityLogEntry[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 50).map((entry, index) => {
    const raw = entry && typeof entry === 'object' ? entry as Partial<GangActivityLogEntry> : {};
    const tone: GangActivityLogTone = ['positive', 'negative', 'warning', 'neutral'].includes(String(raw.tone))
      ? raw.tone as GangActivityLogTone
      : 'neutral';
    return {
      id: String(raw.id || `legacy_log_${index}`).slice(0, 100),
      message: String(raw.message || '').slice(0, 220),
      tone,
      createdAt: Math.max(0, Number(raw.createdAt || Date.now())),
    };
  }).filter((entry) => entry.message);
}

export function applyWorkFatigue(
  members: GangMember[],
  participantIds: string[],
  workType: string,
): WorkFatigueResult {
  const participants = new Set(participantIds);
  const penalized: GangMember[] = [];
  const nextMembers = members.map((member) => {
    if (!participants.has(member.id)) return member;
    const nextRuns = member.lastWorkType === workType ? member.consecutiveWorkRuns + 1 : 1;
    if (nextRuns < 2) {
      return {
        ...member,
        lastWorkType: workType,
        consecutiveWorkRuns: nextRuns,
      };
    }
    const next = {
      ...member,
      loyalty: Math.max(0, member.loyalty - 5),
      lastWorkType: workType,
      consecutiveWorkRuns: 0,
    };
    penalized.push(next);
    return next;
  });
  return { members: nextMembers, penalized };
}
