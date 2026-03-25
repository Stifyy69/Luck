import { useEffect, useState } from 'react';
import SharedStatsPanel from './SharedStatsPanel';
import PageDisclaimer from './PageDisclaimer';

type Post = {
  id: number;
  item_key: string;
  item_name: string;
  item_type: 'car' | 'cloth';
  image_url: string;
  price: number;
  bot_name: string;
};

export default function MarketplacePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [offers, setOffers] = useState<Record<number, string>>({});
  const [inventory, setInventory] = useState<Array<{ item_key: string; item_name: string; item_type: string; quantity: number }>>([]);
  const [popup, setPopup] = useState<string | null>(null);

  const loadData = async () => {
    const [postsRes, invRes] = await Promise.all([
      fetch('/api/market/posts', { credentials: 'include' }),
      fetch('/api/inventory', { credentials: 'include' }),
    ]);
    if (postsRes.ok) {
      const data = await postsRes.json();
      setPosts(data.posts || []);
    }
    if (invRes.ok) {
      const data = await invRes.json();
      setInventory(data.items || []);
    }
  };

  useEffect(() => {
    loadData().catch(() => {});
    const timer = window.setInterval(() => loadData().catch(() => {}), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const buy = async (postId: number) => {
    const res = await fetch('/api/market/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ postId }),
    });
    if (!res.ok) {
      setPopup('Trebuie cont + login ca să cumperi.');
      window.setTimeout(() => setPopup(null), 2200);
      return;
    }
    setPopup('Item adăugat în inventar.');
    window.setTimeout(() => setPopup(null), 2200);
    loadData().catch(() => {});
  };

  const offer = async (postId: number) => {
    const value = Number(offers[postId] || 0);
    if (!value) return;
    const res = await fetch('/api/market/offer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ postId, offerPrice: value }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPopup('Trebuie cont + login pentru ofertă.');
      window.setTimeout(() => setPopup(null), 2200);
      return;
    }
    setPopup(data.message || (data.accepted ? 'Acceptat.' : 'Respins.'));
    window.setTimeout(() => setPopup(null), 2200);
    loadData().catch(() => {});
  };

  return (
    <div className="min-h-screen bg-transparent px-4 pb-10 pt-20 text-white sm:px-6">
      <div className="mx-auto grid max-w-[1460px] grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="hud-panel p-4 sm:p-6">
          <h1 className="text-center text-4xl font-black uppercase tracking-tight">Marketplace</h1>
          <p className="mt-2 text-center text-white/70">Botii postează mașini și haine la fiecare 5 minute.</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {posts.map((post) => (
              <div key={post.id} className="hud-card p-3">
                <img src={post.image_url} alt={post.item_name} className="h-28 w-full rounded-lg object-contain bg-black/25 p-2" />
                <p className="mt-2 text-lg font-black">{post.item_name}</p>
                <p className="text-sm text-white/65">{post.bot_name} · {post.item_type}</p>
                <p className="text-sm text-amber-300">{Number(post.price).toLocaleString('ro-RO')} $</p>
                <div className="mt-3 flex gap-2">
                  <button className="btn-primary flex-1 rounded-lg px-3 py-2 text-sm font-bold" type="button" onClick={() => buy(post.id)}>Cumpără</button>
                  <input
                    className="input-dark w-24 rounded-lg px-2 py-2 text-xs"
                    placeholder="Ofertă"
                    value={offers[post.id] ?? ''}
                    onChange={(e) => setOffers((current) => ({ ...current, [post.id]: e.target.value }))}
                  />
                  <button className="btn-secondary rounded-lg px-3 py-2 text-xs font-bold" type="button" onClick={() => offer(post.id)}>NPC</button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 hud-card p-4">
            <p className="text-sm font-black uppercase tracking-[0.12em] text-white/65">Inventar (marketplace)</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {inventory.length === 0 ? <p className="text-sm text-white/60">Inventarul este gol.</p> : inventory.map((item) => (
                <div key={item.item_key} className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <p className="text-sm font-bold">{item.item_name}</p>
                  <p className="text-xs text-white/60">{item.item_type}</p>
                  <p className="text-base font-black text-emerald-300">x{item.quantity}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <SharedStatsPanel />
      </div>
      <div className="mx-auto mt-5 max-w-[1460px]"><PageDisclaimer /></div>

      {popup ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4" onClick={() => setPopup(null)}>
          <div className="hud-panel w-full max-w-md p-4 text-center font-bold">{popup}</div>
        </div>
      ) : null}
    </div>
  );
}
