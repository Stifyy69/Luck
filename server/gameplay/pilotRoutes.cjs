// Route order, rewards and locations approved for Pilot V2. The final three routes
// take 50 completions; all earlier routes take 20.
const missions = [
  ['Skydivers', 'Los Santos -> Farm', 15, 20_000, 25, 120, 1, [
    'Check parachutes', 'Board skydivers', 'Fly toward Farm', 'Deploy skydivers',
  ], 'Confirm skydiver deployment'],
  ['Farm Recon', 'Farm -> Lighthouse', 17, 24_000, 29, 140, 3, [
    'Prepare survey aircraft', 'Take off from Farm', 'Survey the coastline', 'Report at Lighthouse',
  ], 'Confirm survey report'],
  ['Coastal Patrol', 'Lighthouse -> Paleto', 19, 28_000, 33, 160, 4, [
    'Review patrol sector', 'Take off from Lighthouse', 'Scan the coastline', 'Approach Paleto', 'File patrol report',
  ], 'Confirm patrol report'],
  ['Fertilizer Run', 'Paleto -> Farm', 21, 32_000, 37, 180, 6, [
    'Load fertilizer', 'Check spray system', 'Depart Paleto', 'Line up over Farm', 'Release fertilizer',
  ], 'Confirm fertilizer release'],
  ['Harvest Cargo', 'Farm -> Los Santos', 23, 36_000, 41, 200, 8, [
    'Inspect cargo', 'Secure the harvest', 'Depart Farm', 'Cross the city approach', 'Deliver to Los Santos',
  ], 'Confirm cargo delivery'],
  ['Lighthouse Rescue', 'Los Santos -> Lighthouse', 25, 40_000, 45, 220, 10, [
    'Receive rescue call', 'Prepare rescue gear', 'Depart Los Santos', 'Locate the signal', 'Approach Lighthouse', 'Confirm rescue',
  ], 'Confirm rescue pickup'],
  ['Military Cargo', 'Lighthouse -> Military Base', 27, 44_000, 49, 240, 12, [
    'Receive military clearance', 'Inspect cargo manifest', 'Load sealed crates', 'Depart Lighthouse', 'Enter controlled airspace', 'Hand over cargo',
  ], 'Confirm secure cargo handover'],
  ['Secure Transport', 'Military Base -> Paleto', 29, 48_000, 53, 260, 15, [
    'Verify escort orders', 'Secure the cabin', 'Take off from Military Base', 'Check escort channel', 'Approach Paleto', 'Complete escort transfer',
  ], 'Confirm escort transfer'],
  ['Long Range Rescue', 'Paleto -> Maldive', 31, 52_000, 57, 280, 17, [
    'Review offshore coordinates', 'Load rescue supplies', 'Take off from Paleto', 'Cross open water', 'Locate the crew', 'Approach Maldive', 'Complete extraction',
  ], 'Confirm offshore extraction'],
  ['Island Passengers', 'Maldive -> Los Santos', 33, 56_000, 61, 300, 19, [
    'Verify passengers', 'Load luggage', 'Depart Maldive', 'Cross open water', 'Prepare city approach', 'Land in Los Santos', 'Disembark passengers',
  ], 'Confirm passenger disembarkation'],
  ['Medical Stopovers', 'Los Santos -> Paleto -> Lighthouse', 35, 60_000, 65, 320, 22, [
    'Prepare medical supplies', 'Depart Los Santos', 'Land at Paleto', 'Transfer medical team', 'Depart Paleto', 'Approach Lighthouse', 'Deliver supplies',
  ], 'Confirm medical handover'],
  ['Storm Evacuation', 'Lighthouse -> Military Base', 37, 64_000, 69, 340, 24, [
    'Check storm briefing', 'Board evacuees', 'Depart Lighthouse', 'Navigate rough weather', 'Request military clearance', 'Prepare landing', 'Land at Military Base', 'Confirm evacuation',
  ], 'Confirm evacuee transfer'],
  ['Secure Island Supply', 'Military Base -> Maldive', 40, 68_000, 73, 360, 27, [
    'Verify classified cargo', 'Load secure supplies', 'Receive takeoff clearance', 'Depart Military Base', 'Cross open water', 'Check destination signal', 'Land at Maldive', 'Hand over supplies',
  ], 'Confirm secure supply transfer'],
  ['VIP Evacuation', 'Maldive -> Paleto -> Los Santos', 43, 72_000, 77, 380, 34, [
    'Verify VIP manifest', 'Board passengers', 'Depart Maldive', 'Navigate offshore route', 'Land at Paleto', 'Transfer escort', 'Depart Paleto', 'Deliver to Los Santos',
  ], 'Confirm VIP escort transfer'],
  ['Final Operation', 'Los Santos -> Military Base -> Maldive -> Lighthouse', 46, 76_000, 81, 400, 40, [
    'Review final operation', 'Load mission team', 'Depart Los Santos', 'Collect orders at Military Base', 'Cross open water', 'Deliver equipment at Maldive', 'Depart Maldive', 'Approach Lighthouse', 'Confirm final operation',
  ], 'Confirm final operation'],
];

const routes = Object.freeze(missions.map((mission, index) => {
  const [theme, routePath, durationSeconds, baseReward, baseXp, cityXp, unlockLevel, stages, checkpointLabel] = mission;
  const series = Math.floor(index / 3) + 1;
  const number = index % 3 + 1;
  return Object.freeze({
    id: `ROUTE_${series}_${number}`,
    index: index + 1,
    name: `Route ${series}-${number}`,
    theme,
    routePath,
    durationSeconds,
    baseReward,
    baseXp,
    cityXp,
    unlockLevel,
    requiredPreviousRouteId: index ? `ROUTE_${Math.floor((index - 1) / 3) + 1}_${((index - 1) % 3) + 1}` : null,
    requiredPreviousCompletions: index ? (index - 1 < 12 ? 20 : 50) : 0,
    progressionCompletions: index < 12 ? 20 : 50,
    stages: Object.freeze(stages),
    checkpointStageIndex: Math.floor(stages.length / 2),
    checkpointLabel,
  });
}));

module.exports = { routes };
