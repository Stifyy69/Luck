import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../../hooks/usePlayer';
import { awardCayoCityXp, subscribeCityProgress } from '../../lib/cityProgressApi';
import { readPlayerCityProgress, type CityProgress } from '../../lib/cityProgress';

const GAME_KEY = 'luck_game_state_v1';
const GAME_SALT = 'stifyy-ogromania-salt';
const CHECKPOINT_PREFIX = 'city_cayo_checkpoint_v1:';

type CayoCounters = {
  leaves: number;
  white: number;
  blue: number;
};

function signPayload(payload: unknown) {
  const raw = JSON.stringify(payload) + GAME_SALT;
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) hash = (hash * 31 + raw.charCodeAt(index)) >>> 0;
  return String(hash);
}

function readCounters(): CayoCounters {
  try {
    const raw = localStorage.getItem(GAME_KEY);
    if (!raw) return { leaves: 0, white: 0, blue: 0 };
    const parsed = JSON.parse(raw);
    if (!parsed?.data || signPayload(parsed.data) !== parsed.sig) return { leaves: 0, white: 0, blue: 0 };
    const data = parsed.data;
    return {
      leaves: Math.max(0, Number(data.processedLeaves || 0)),
      white: Math.max(0, Number(data.processedWhite || 0)),
      blue: Math.max(0, Number(data.processedBlue || 0)),
    };
  } catch {
    return { leaves: 0, white: 0, blue: 0 };
  }
}

function readCheckpoint(playerId: string): CayoCounters | null {
  try {
    const raw = localStorage.getItem(`${CHECKPOINT_PREFIX}${playerId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      leaves: Math.max(0, Number(parsed.leaves || 0)),
      white: Math.max(0, Number(parsed.white || 0)),
      blue: Math.max(0, Number(parsed.blue || 0)),
    };
  } catch {
    return null;
  }
}

function writeCheckpoint(playerId: string, counters: CayoCounters) {
  localStorage.setItem(`${CHECKPOINT_PREFIX}${playerId}`, JSON.stringify(counters));
}

export default function CityCayoProgressBridge() {
  const { playerId, player } = usePlayer();
  const playerProgress = readPlayerCityProgress(player);
  const [progress, setProgress] = useState<CityProgress | null>(playerProgress);
  const runningRef = useRef(false);

  useEffect(() => {
    if (playerProgress) setProgress(playerProgress);
  }, [playerProgress?.xp, playerProgress?.level]);

  useEffect(() => subscribeCityProgress(({ progress: next }) => setProgress(next)), []);

  useEffect(() => {
    if (!playerId || (progress?.level || 1) < 10) return;

    const sync = async () => {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        const current = readCounters();
        const checkpoint = readCheckpoint(playerId);
        if (!checkpoint) {
          writeCheckpoint(playerId, current);
          return;
        }

        const next = { ...checkpoint };
        const tasks: Array<{ stage: 'COLLECT' | 'PROCESS' | 'REFINE'; count: number; step: number; key: keyof CayoCounters }> = [
          { stage: 'COLLECT', count: current.leaves, step: 1200, key: 'leaves' },
          { stage: 'PROCESS', count: current.white, step: 400, key: 'white' },
          { stage: 'REFINE', count: current.blue, step: 800, key: 'blue' },
        ];

        for (const task of tasks) {
          if (task.count <= checkpoint[task.key]) {
            next[task.key] = Math.max(next[task.key], task.count);
            continue;
          }
          const completedRuns = Math.min(1, Math.floor((task.count - checkpoint[task.key]) / task.step));
          for (let index = 1; index <= completedRuns; index += 1) {
            const marker = checkpoint[task.key] + task.step * index;
            await awardCayoCityXp(playerId, task.stage, `${task.key}:${marker}`);
            next[task.key] = marker;
          }
        }

        writeCheckpoint(playerId, next);
      } catch {
        // Keep the old checkpoint so an interrupted award can retry with the same idempotency key.
      } finally {
        runningRef.current = false;
      }
    };

    sync().catch(() => {});
    const timer = window.setInterval(() => sync().catch(() => {}), 5200);
    return () => window.clearInterval(timer);
  }, [playerId, progress?.level]);

  return null;
}
