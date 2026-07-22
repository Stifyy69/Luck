import { getGangLevel } from '../lib/gangProgression';
import { useGangController } from '../hooks/useGangController';
import PageDisclaimer from './PageDisclaimer';
import GangActivityOverlay from './gangs/GangActivityOverlay';
import GangBattleOverlay from './gangs/GangBattleOverlay';
import GangBattlesPanel from './gangs/GangBattlesPanel';
import GangFinancePanel from './gangs/GangFinancePanel';
import GangLoyaltySupportModal from './gangs/GangLoyaltySupportModal';
import GangMemberCard from './gangs/GangMemberCard';
import GangOverviewPanel from './gangs/GangOverviewPanel';
import GangRecruitmentBoard from './gangs/GangRecruitmentBoard';
import GangStoragePanel from './gangs/GangStoragePanel';
import GangUpgradeModal from './gangs/GangUpgradeModal';
import GangWorkPanel from './gangs/GangWorkPanel';

export type GangSection = 'overview' | 'work' | 'members' | 'recruitment' | 'storage' | 'finance' | 'battles';

export default function GangsPage({ section = 'overview' }: { section?: GangSection }) {
  const gang = useGangController();
  const nextLevel = gang.level.index < 3 ? getGangLevel(gang.level.index + 1).name : null;

  const renderSection = () => {
    if (section === 'overview') {
      return <GangOverviewPanel name={gang.gangData.name} level={gang.level.name} memberCount={gang.gangData.members.length} maxMembers={gang.maxMembers} averageLoyalty={gang.averageLoyalty} currentWorking={gang.gangData.onlineNow} cleanBalance={gang.gangData.cleanBalance} dirtyBalance={gang.gangData.dirtyBalance} stockValue={gang.stockValue} battleReputation={gang.gangData.battleReputation} resources={gang.gangData} upgradeCost={gang.upgradeCost} canUpgrade={gang.canUpgrade} activityLog={gang.gangData.activityLog} onUpgrade={() => gang.setUpgradeOpen(true)} />;
    }
    if (section === 'work') {
      return <GangWorkPanel busy={gang.busy} memberCount={gang.availableMembers.length} levelIndex={gang.gangData.levelIndex} transportMembers={gang.transportMembers} onTransportMembersChange={gang.setTransportMembers} storage={gang.gangData} dirtyBalance={gang.gangData.dirtyBalance} onCollect={() => void gang.startCollection()} onMining={() => void gang.startMining()} onTransport={() => void gang.startTransport()} onProcess={(type, batches) => void gang.startProcessing(type, batches)} onOpenBattles={gang.openBattles} />;
    }
    if (section === 'storage') {
      return <GangStoragePanel storage={gang.gangData} onSell={gang.sellMaterial} />;
    }
    if (section === 'finance') {
      return <GangFinancePanel gangClean={gang.gangData.cleanBalance} gangDirty={gang.gangData.dirtyBalance} personalClean={gang.cashBalance} personalDirty={gang.baniMurdari} totalEarned={gang.gangData.dirtyEarned} onDeposit={gang.deposit} onWithdraw={gang.withdraw} onLaunder={gang.launder} />;
    }
    if (section === 'battles') {
      return <GangBattlesPanel opponents={gang.opponents} members={gang.gangData.members} currentGameHour={gang.currentGameHour} defensiveCrewIds={gang.gangData.defensiveCrewIds} history={gang.gangData.battleHistory} reputation={gang.gangData.battleReputation} gangCleanBalance={gang.gangData.cleanBalance} busy={gang.busy} onAttack={gang.startBattle} onSaveDefense={gang.saveDefensiveCrew} onTreat={gang.treatMember} onRefreshOpponents={gang.refreshOpponents} />;
    }
    if (section === 'recruitment') {
      if (gang.isFull) return <section className="game-panel p-8 text-center"><p className="section-kicker">Recruitment</p><h1 className="mt-3 text-3xl font-black text-white">Roster full</h1></section>;
      return <GangRecruitmentBoard candidates={gang.gangData.recruitmentBoard} recruitingCandidateId={gang.recruitingCandidate?.id || null} recruitTimer={gang.recruitTimer} disabled={gang.busy} isFull={gang.isFull} onRecruit={gang.startRecruit} />;
    }
    return (
      <section className="game-panel p-5 sm:p-7">
        <div className="flex items-end justify-between gap-3"><div><p className="section-kicker">Gang members</p><h1 className="mt-3 text-3xl font-black text-white">Members</h1></div><span className="rounded-full border border-white/[0.08] bg-black/20 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-white/45">Recruiting {Math.min(100, gang.recruitingPower)}</span></div>
        <div className="mt-6 grid gap-3 xl:grid-cols-2">{gang.gangData.members.map((member) => <GangMemberCard key={member.id} member={member} currentGameHour={gang.currentGameHour} disabled={gang.busy} onDismiss={gang.setDismissTarget} onSupport={gang.setSupportTarget} />)}</div>
      </section>
    );
  };

  return (
    <div className="min-h-screen bg-transparent px-4 pb-10 pt-24 text-white sm:px-6 md:px-8">
      {gang.popup ? <div className="animate-toast-in fixed left-1/2 top-4 z-[145] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-2xl border border-[rgba(211,255,81,0.22)] bg-[#11170d]/95 px-4 py-3 text-sm font-bold text-[#edffc0] shadow-2xl backdrop-blur-xl md:top-6">{gang.popup}</div> : null}
      <GangActivityOverlay activity={gang.activity} />
      <GangBattleOverlay battle={gang.battleOverlay} />
      <div className="mx-auto max-w-[1220px]">
        {!gang.formed ? (
          <section className="game-panel mx-auto max-w-2xl p-5 sm:p-7">
            <p className="section-kicker">Create gang</p><h1 className="mt-3 text-3xl font-black text-white">Create your gang</h1>
            <input value={gang.gangNameInput} onChange={(event) => gang.setGangNameInput(event.target.value)} placeholder="Gang name" className="mt-5 w-full rounded-xl border border-white/[0.08] bg-black/25 px-4 py-3 text-sm font-bold text-white outline-none" />
            <button type="button" disabled={gang.busy} onClick={gang.formGang} className="btn-primary mt-3 w-full rounded-xl px-4 py-3 text-sm disabled:opacity-35">Create for 10,000,000 dirty</button>
          </section>
        ) : renderSection()}
      </div>
      <div className="mx-auto mt-5 max-w-[1220px]"><PageDisclaimer /></div>

      {gang.dismissTarget ? <div className="fixed inset-0 z-[134] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={() => gang.setDismissTarget(null)}><div className="game-panel w-full max-w-md p-5" onClick={(event) => event.stopPropagation()}><p className="section-kicker">Dismiss member</p><h2 className="mt-3 text-2xl font-black text-white">Remove {gang.dismissTarget.displayName}?</h2><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => gang.setDismissTarget(null)} className="btn-ghost rounded-xl px-4 py-3 text-sm">Cancel</button><button type="button" onClick={gang.confirmDismiss} className="rounded-xl border border-red-300/20 bg-red-500/15 px-4 py-3 text-sm font-black text-red-100">Dismiss</button></div></div></div> : null}

      <GangLoyaltySupportModal member={gang.supportTarget} gangCleanBalance={gang.gangData.cleanBalance} onClose={() => gang.setSupportTarget(null)} onPurchase={gang.buyLoyaltySupport} />
      {gang.upgradeOpen ? <GangUpgradeModal cost={gang.upgradeCost} currentLevel={gang.level.name} nextLevel={nextLevel} balances={gang.gangData} onClose={() => gang.setUpgradeOpen(false)} onConfirm={() => void gang.confirmUpgrade()} /> : null}
    </div>
  );
}
