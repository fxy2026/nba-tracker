"use client";

import { useState, useEffect, useCallback } from "react";
import { Lock, Plus, Trash2, Search, Play, ExternalLink, Calendar, BarChart3, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

interface ScheduleGame {
  gameId: string;
  gameStatus: number;
  gameStatusText: string;
  homeTeam: { teamTricode: string; teamName: string; teamCity: string; score: number };
  awayTeam: { teamTricode: string; teamName: string; teamCity: string; score: number };
}

interface ReplayLink {
  id: string;
  game_id: string;
  title: string;
  url: string;
  source: string;
}

type Tab = "replays" | "dashboard";

export default function AdminPage() {
  const { t } = useLocale();
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [tab, setTab] = useState<Tab>("replays");

  // Replay management
  const [searchDate, setSearchDate] = useState(() =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date())
  );
  const [games, setGames] = useState<ScheduleGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGame, setSelectedGame] = useState<ScheduleGame | null>(null);
  const [replayLinks, setReplayLinks] = useState<ReplayLink[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newSource, setNewSource] = useState("cloud");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");

  // Dashboard
  const [apiHealth, setApiHealth] = useState<Record<string, boolean>>({});
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [adminStats, setAdminStats] = useState<Record<string, unknown> | null>(null);
  const [, setLoadingStats] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  const [loginLoading, setLoginLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) { setAuthError(t.admin.enterPassword); return; }
    setLoginLoading(true);
    setAuthError("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) { setAuthenticated(true); setAuthError(""); }
      else {
        const data = await res.json().catch(() => ({}));
        setAuthError(data.error || "Password incorrect");
      }
    } catch {
      setAuthError("Network error — check connection");
    }
    setLoginLoading(false);
  }

  const searchGames = useCallback(async (date?: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/games?date=${date || searchDate}`);
      const data = await res.json();
      setGames(data.data || []);
    } catch { setGames([]); }
    setLoading(false);
  }, [searchDate]);

  async function loadReplayLinks(gameId: string) {
    const res = await fetch(`/api/replay?game_id=${gameId}`);
    const data = await res.json();
    setReplayLinks(data.data || []);
  }

  async function addLink(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGame || !newTitle || !newUrl) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ game_id: selectedGame.gameId, title: newTitle, url: newUrl, source: newSource }),
      });
      if (res.ok) { showToast("Link added!"); setNewTitle(""); setNewUrl(""); setNewSource("cloud"); loadReplayLinks(selectedGame.gameId); }
      else { showToast("Failed to add link"); }
    } catch { showToast("Network error"); }
    setSubmitting(false);
  }

  async function removeLink(id: string) {
    if (!selectedGame || !confirm("Delete this link?")) return;
    try {
      await fetch(`/api/replay?id=${id}`, { method: "DELETE", headers: { "x-admin-password": password } });
      showToast("Link removed");
      loadReplayLinks(selectedGame.gameId);
    } catch { showToast("Failed to delete"); }
  }

  function offsetDate(days: number) {
    const d = new Date(searchDate); d.setDate(d.getDate() + days);
    const ds = d.toISOString().split("T")[0];
    setSearchDate(ds); searchGames(ds);
  }

  async function checkAPIHealth() {
    setCheckingHealth(true);
    const endpoints = [
      { name: "Standings", url: "/api/standings" },
      { name: "Search", url: "/api/search?q=test" },
      { name: "News", url: "/api/news" },
      { name: "Injuries", url: "/api/injuries" },
      { name: "Transactions", url: "/api/transactions" },
      { name: "Games", url: "/api/games?date=2026-04-29" },
    ];
    const results: Record<string, boolean> = {};
    await Promise.all(endpoints.map(async (ep) => {
      try {
        const c = new AbortController(); setTimeout(() => c.abort(), 5000);
        const res = await fetch(ep.url, { signal: c.signal });
        results[ep.name] = res.ok;
      } catch { results[ep.name] = false; }
    }));
    setApiHealth(results);
    setCheckingHealth(false);
  }

  async function loadAdminStats() {
    setLoadingStats(true);
    try {
      const res = await fetch("/api/admin/stats", { headers: { "x-admin-password": password } });
      if (res.ok) setAdminStats(await res.json());
    } catch { /* ignore */ }
    setLoadingStats(false);
  }

  // Auth-triggered admin data fetch — those functions setState internally.
  useEffect(() => {
    if (authenticated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      searchGames();
      checkAPIHealth();
      loadAdminStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  // ===== Login Screen =====
  if (!authenticated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <form onSubmit={handleLogin} className="glass-tile p-8 w-full max-w-sm">
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 bg-accent/15 rounded-full flex items-center justify-center">
              <Lock size={24} className="text-accent" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-center mb-6">{t.admin.login}</h1>
          {authError && <p className="text-danger text-sm text-center mb-4">{authError}</p>}
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder={t.admin.passwordPlaceholder}
            className="w-full bg-bg-primary border border-border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent mb-4" />
          <button type="submit" disabled={loginLoading} className="w-full bg-accent hover:bg-accent-hover text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50">
            {loginLoading ? t.admin.loggingIn : t.admin.loginBtn}
          </button>
        </form>
      </div>
    );
  }

  // ===== Admin Panel =====
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {toast && <div className="fixed top-20 right-4 z-50 px-4 py-2 bg-accent text-white text-sm rounded-lg shadow-lg animate-fade-in">{toast}</div>}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Lock size={20} className="text-accent" />{t.admin.panel}</h1>
        <div className="flex gap-1 bg-bg-card rounded-lg border border-border p-0.5">
          {([{ key: "replays" as Tab, label: t.admin.replayLinks, icon: Play }, { key: "dashboard" as Tab, label: t.admin.dashboard, icon: BarChart3 }]).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === key ? "bg-accent text-white" : "text-text-secondary hover:text-text-primary"}`}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>
      </div>

      {/* ===== Dashboard ===== */}
      {tab === "dashboard" && (
        <div className="space-y-6">
          {/* Data Overview */}
          {adminStats ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="glass-tile p-4 text-center">
                <p className="text-2xl font-light font-mono tabular-nums text-accent-amber">{String(adminStats.replayCount ?? "—")}</p>
                <p className="text-[10px] text-text-secondary uppercase mt-1">{t.admin.replayLinks}</p>
              </div>
              <div className="glass-tile p-4 text-center">
                <p className="text-2xl font-light font-mono tabular-nums text-text-primary">{String(adminStats.replayGames ?? "—")}</p>
                <p className="text-[10px] text-text-secondary uppercase mt-1">{t.admin.gamesWithReplay}</p>
              </div>
              <div className="glass-tile p-4 text-center">
                <p className="text-2xl font-light font-mono tabular-nums text-success">{String(adminStats.finishedGames ?? "—")}</p>
                <p className="text-[10px] text-text-secondary uppercase mt-1">{t.admin.finishedGames}</p>
              </div>
              <div className="glass-tile p-4 text-center">
                <p className="text-2xl font-light font-mono tabular-nums text-text-primary">{String(adminStats.playerCount ?? "—")}</p>
                <p className="text-[10px] text-text-secondary uppercase mt-1">{t.admin.playersIndexed}</p>
              </div>
            </div>
          ) : null}

          {/* Recent Replay Links */}
          {adminStats?.recentLinks && (adminStats.recentLinks as ReplayLink[]).length > 0 ? (
            <div className="glass-tile p-4">
              <h2 className="text-sm font-semibold mb-3">{t.admin.recentlyAdded}</h2>
              <div className="space-y-2">
                {(adminStats.recentLinks as ReplayLink[]).map((link) => (
                  <div key={link.id} className="flex items-center gap-2 px-3 py-2 bg-bg-secondary rounded-lg text-xs">
                    <Play size={12} className="text-accent shrink-0" />
                    <span className="text-text-primary font-medium truncate flex-1">{link.title}</span>
                    <span className="text-text-secondary shrink-0">{link.game_id}</span>
                    <span className={`px-1.5 py-0.5 rounded shrink-0 ${link.source === "youtube" ? "bg-danger/10 text-danger" : link.source === "bilibili" ? "bg-blue-400/10 text-accent" : "bg-bg-hover text-text-secondary"}`}>{link.source}</span>
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline shrink-0"><ExternalLink size={10} /></a>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* API Health */}
          <div className="glass-tile p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">API Health Check</h2>
              <button onClick={checkAPIHealth} disabled={checkingHealth}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-bg-hover rounded-lg hover:bg-accent/10 text-text-secondary hover:text-accent transition-colors disabled:opacity-50">
                <RefreshCw size={12} className={checkingHealth ? "animate-spin" : ""} />{checkingHealth ? "Checking..." : "Refresh"}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(apiHealth).map(([name, ok]) => (
                <div key={name} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${ok ? "bg-success/10" : "bg-danger/10"}`}>
                  <span className={`w-2 h-2 rounded-full ${ok ? "bg-success" : "bg-danger"}`} />
                  <span className="text-text-primary">{name}</span>
                  <span className={`text-xs ml-auto ${ok ? "text-success" : "text-danger"}`}>{ok ? t.admin.ok : t.admin.down}</span>
                </div>
              ))}
              {Object.keys(apiHealth).length === 0 && <p className="text-xs text-text-secondary col-span-3 text-center py-4">{t.admin.clickRefresh}</p>}
            </div>
          </div>

          {/* Environment Config */}
          {adminStats ? (
            <div className="glass-tile p-4">
              <h2 className="text-sm font-semibold mb-3">{t.admin.environment}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {[
                  { label: t.admin.supabase, ok: adminStats.hasSupabase as boolean },
                  { label: t.admin.adminPassword, ok: adminStats.hasAdminPw as boolean },
                  { label: t.admin.ballDontLieApi, ok: adminStats.hasBdlKey as boolean },
                ].map(({ label, ok }) => (
                  <div key={label} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${ok ? "bg-success/10" : "bg-accent-amber/10"}`}>
                    <span className={`w-2 h-2 rounded-full ${ok ? "bg-success" : "bg-accent-amber"}`} />
                    <span className="text-text-primary">{label}</span>
                    <span className={`ml-auto ${ok ? "text-success" : "text-accent-amber"}`}>{ok ? t.admin.set : t.admin.missing}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-text-secondary mt-2">
                ENV: {String(adminStats.vercelEnv)} · Node: {String(adminStats.nodeEnv)} · Teams: {String(adminStats.activeTeams ?? "—")} · Schedule: {String(adminStats.scheduleDates ?? "—")} days
              </p>
            </div>
          ) : null}

          {/* System Info + Quick Links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-tile p-4 text-center">
              <p className="text-[10px] text-text-secondary uppercase">{t.admin.dataSources}</p>
              <p className="text-sm font-bold text-text-primary mt-1">{t.admin.nbaCdnEspn}</p>
              <p className="text-[10px] text-text-secondary mt-1">{t.admin.scheduleScores}</p>
            </div>
            <div className="glass-tile p-4 text-center">
              <p className="text-[10px] text-text-secondary uppercase">{t.admin.replayStorage}</p>
              <p className="text-sm font-bold text-text-primary mt-1">{t.admin.supabase}</p>
              <p className="text-[10px] text-text-secondary mt-1">{t.admin.postgresql}</p>
            </div>
            <div className="glass-tile p-4 text-center">
              <p className="text-[10px] text-text-secondary uppercase">{t.admin.hosting}</p>
              <p className="text-sm font-bold text-text-primary mt-1">Vercel</p>
              <p className="text-[10px] text-text-secondary mt-1">nba.xpy.me</p>
            </div>
          </div>

          <div className="glass-tile p-4">
            <h2 className="text-sm font-semibold mb-3">{t.admin.quickLinks}</h2>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Vercel", href: "https://vercel.com/dashboard" },
                { label: "Supabase", href: "https://supabase.com/dashboard" },
                { label: "GitHub", href: "https://github.com/fxy2026/nba-tracker" },
                { label: "Live Site", href: "https://nba.xpy.me" },
                { label: "NBA.com", href: "https://www.nba.com" },
                { label: "ESPN", href: "https://www.espn.com/nba/" },
              ].map((link) => (
                <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-bg-hover rounded-lg hover:bg-accent/10 text-text-secondary hover:text-accent transition-colors">
                  <ExternalLink size={12} />{link.label}
                </a>
              ))}
            </div>
          </div>

          <button onClick={loadAdminStats} className="w-full text-xs text-text-secondary hover:text-accent py-2 transition-colors">
            {t.admin.refreshDashboard}
          </button>
        </div>
      )}

      {/* ===== Replay Links ===== */}
      {tab === "replays" && (
        <>
          <div className="glass-tile p-4 mb-6">
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => offsetDate(-1)} className="p-2 rounded-lg bg-bg-hover hover:bg-accent/10 text-text-secondary hover:text-accent transition-colors"><ChevronLeft size={16} /></button>
              <input type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)}
                className="bg-bg-primary border border-border rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:border-accent" />
              <button onClick={() => offsetDate(1)} className="p-2 rounded-lg bg-bg-hover hover:bg-accent/10 text-text-secondary hover:text-accent transition-colors"><ChevronRight size={16} /></button>
              <button onClick={() => searchGames()} className="flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"><Search size={16} />{t.admin.searchLabel}</button>
              <div className="ml-auto flex gap-1">
                {[-1, 0, 1].map((offset) => {
                  const d = new Date(); d.setDate(d.getDate() + offset);
                  const ds = d.toISOString().split("T")[0];
                  return (
                    <button key={offset} onClick={() => { setSearchDate(ds); searchGames(ds); }}
                      className={`px-2.5 py-1.5 text-[10px] rounded-lg transition-colors ${searchDate === ds ? "bg-accent text-white" : "bg-bg-hover text-text-secondary hover:text-accent"}`}>
                      {offset === -1 ? t.admin.yesterday : offset === 0 ? t.admin.todayLabel : t.admin.tomorrow}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Games List */}
            <div>
              <h2 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
                <Calendar size={14} />Games ({games.length})<span className="text-[10px] ml-1">{searchDate}</span>
              </h2>
              {loading ? (
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 skeleton-shimmer rounded-xl" />)}</div>
              ) : (
                <div className="space-y-2">
                  {games.map((game) => {
                    const isFinal = game.gameStatus === 3;
                    return (
                      <button key={game.gameId} onClick={() => { setSelectedGame(game); loadReplayLinks(game.gameId); }}
                        className={`w-full text-left bg-bg-card rounded-xl border p-3 transition-colors ${selectedGame?.gameId === game.gameId ? "border-accent ring-1 ring-accent/30" : "border-border hover:border-accent/50"}`}>
                        <div className="flex items-center justify-between">
                          <div className="text-sm">
                            <span className="font-medium">{game.awayTeam.teamTricode}</span>
                            <span className="text-text-secondary mx-2">{isFinal ? `${game.awayTeam.score} - ${game.homeTeam.score}` : "vs"}</span>
                            <span className="font-medium">{game.homeTeam.teamTricode}</span>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${isFinal ? "bg-success/10 text-success" : game.gameStatus === 2 ? "bg-accent/10 text-accent" : "bg-bg-hover text-text-secondary"}`}>
                            {isFinal ? t.common.final : game.gameStatus === 2 ? t.common.live : t.common.scheduled}
                          </span>
                        </div>
                        <p className="text-[10px] text-text-secondary mt-1">{game.awayTeam.teamCity} @ {game.homeTeam.teamCity} <span className="text-text-secondary/50 ml-1">{t.admin.id}{game.gameId}</span></p>
                      </button>
                    );
                  })}
                  {games.length === 0 && !loading && <p className="text-sm text-text-secondary text-center py-8">{t.admin.noGamesOn}{searchDate}</p>}
                </div>
              )}
            </div>

            {/* Replay Panel */}
            <div>
              {selectedGame ? (
                <>
                  <h2 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
                    <Play size={14} className="text-accent" />
                    {t.admin.replayLinks} — {selectedGame.awayTeam.teamTricode} vs {selectedGame.homeTeam.teamTricode}
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">{replayLinks.length}</span>
                  </h2>
                  <div className="space-y-2 mb-4">
                    {replayLinks.map((link) => (
                      <div key={link.id} className="bg-bg-card rounded-lg border border-border p-3 flex items-center justify-between group">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Play size={14} className="text-accent shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{link.title}</p>
                            <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-text-secondary hover:text-accent truncate block transition-colors">{link.url}</a>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${link.source === "youtube" ? "bg-danger/10 text-danger" : link.source === "bilibili" ? "bg-blue-400/10 text-accent" : "bg-bg-hover text-text-secondary"}`}>{link.source}</span>
                          <a href={link.url} target="_blank" rel="noopener noreferrer" className="p-1 text-text-secondary hover:text-accent transition-colors shrink-0 opacity-0 group-hover:opacity-100"><ExternalLink size={12} /></a>
                        </div>
                        <button onClick={() => removeLink(link.id)} className="p-1.5 text-text-secondary hover:text-danger transition-colors shrink-0 ml-1"><Trash2 size={14} /></button>
                      </div>
                    ))}
                    {replayLinks.length === 0 && (
                      <div className="text-center py-6 text-text-secondary"><Play size={24} className="mx-auto mb-2 opacity-20" /><p className="text-sm">{t.admin.noReplayLinks}</p></div>
                    )}
                  </div>
                  <form onSubmit={addLink} className="glass-tile p-4 space-y-3">
                    <h3 className="text-sm font-medium flex items-center gap-1.5"><Plus size={14} className="text-accent" />{t.admin.addReplayLink}</h3>
                    <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t.admin.titlePlaceholder}
                      className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent" required />
                    <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder={t.admin.url} type="url"
                      className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent" required />
                    <select value={newSource} onChange={(e) => setNewSource(e.target.value)}
                      className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent">
                      <option value="cloud">{t.admin.cloudDrive}</option>
                      <option value="youtube">{t.admin.youtube}</option>
                      <option value="bilibili">{t.admin.bilibili}</option>
                      <option value="other">{t.admin.other}</option>
                    </select>
                    <button type="submit" disabled={submitting}
                      className="w-full bg-accent hover:bg-accent-hover text-white font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-50">
                      {submitting ? t.admin.adding : t.admin.addLink}
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
                  <Play size={32} className="mb-3 opacity-20" /><p className="text-sm font-medium">{t.admin.selectGame}</p><p className="text-[10px]">{t.admin.chooseFromLeft}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
