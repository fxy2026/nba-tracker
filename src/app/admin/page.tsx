"use client";

import { useState, useEffect } from "react";
import { Lock, Plus, Trash2, Search, Play } from "lucide-react";

interface ScheduleGame {
  gameId: string;
  gameStatus: number;
  gameStatusText: string;
  homeTeam: { teamTricode: string; teamName: string; teamCity: string; score: number };
  awayTeam: { teamTricode: string; teamName: string; teamCity: string; score: number };
}

interface ReplayLink {
  id: string;
  game_id: number;
  title: string;
  url: string;
  source: string;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [searchDate, setSearchDate] = useState(new Date().toISOString().split("T")[0]);
  const [games, setGames] = useState<ScheduleGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGame, setSelectedGame] = useState<ScheduleGame | null>(null);
  const [replayLinks, setReplayLinks] = useState<ReplayLink[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newSource, setNewSource] = useState("cloud");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthenticated(true);
      setAuthError("");
    } else {
      setAuthError("Password incorrect");
    }
  }

  async function searchGames() {
    setLoading(true);
    try {
      const res = await fetch(`/api/games?date=${searchDate}`);
      const data = await res.json();
      setGames(data.data || []);
    } catch {
      setGames([]);
    }
    setLoading(false);
  }

  async function loadReplayLinks(gameId: string) {
    const res = await fetch(`/api/replay?game_id=${gameId}`);
    const data = await res.json();
    setReplayLinks(data.data || []);
  }

  async function addLink(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGame || !newTitle || !newUrl) return;
    await fetch("/api/replay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": password,
      },
      body: JSON.stringify({
        game_id: selectedGame.gameId,
        title: newTitle,
        url: newUrl,
        source: newSource,
      }),
    });
    setNewTitle("");
    setNewUrl("");
    setNewSource("cloud");
    loadReplayLinks(selectedGame.gameId);
  }

  async function removeLink(id: string) {
    if (!selectedGame) return;
    await fetch(`/api/replay?id=${id}`, {
      method: "DELETE",
      headers: { "x-admin-password": password },
    });
    loadReplayLinks(selectedGame.gameId);
  }

  useEffect(() => {
    if (authenticated) searchGames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  if (!authenticated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <form onSubmit={handleLogin} className="bg-bg-card rounded-xl border border-border p-8 w-full max-w-sm">
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 bg-accent/15 rounded-full flex items-center justify-center">
              <Lock size={24} className="text-accent" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-center mb-6">Admin Login</h1>
          {authError && <p className="text-danger text-sm text-center mb-4">{authError}</p>}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter admin password"
            className="w-full bg-bg-primary border border-border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent mb-4"
          />
          <button type="submit" className="w-full bg-accent hover:bg-accent-hover text-white font-medium py-3 rounded-lg transition-colors">
            Login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Admin - Replay Links</h1>

      <div className="bg-bg-card rounded-xl border border-border p-4 mb-6">
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={searchDate}
            onChange={(e) => setSearchDate(e.target.value)}
            className="bg-bg-primary border border-border rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:border-accent"
          />
          <button
            onClick={searchGames}
            className="flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Search size={16} />
            Search
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-sm font-medium text-text-secondary mb-3">Games ({games.length})</h2>
          {loading ? (
            <div className="text-text-secondary text-center py-8">Loading...</div>
          ) : (
            <div className="space-y-2">
              {games.map((game) => (
                <button
                  key={game.gameId}
                  onClick={() => { setSelectedGame(game); loadReplayLinks(game.gameId); }}
                  className={`w-full text-left bg-bg-card rounded-xl border p-3 transition-colors ${
                    selectedGame?.gameId === game.gameId ? "border-accent" : "border-border hover:border-accent/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="font-medium">{game.awayTeam.teamTricode}</span>
                      <span className="text-text-secondary mx-2">
                        {game.awayTeam.score} - {game.homeTeam.score}
                      </span>
                      <span className="font-medium">{game.homeTeam.teamTricode}</span>
                    </div>
                    <span className="text-xs text-text-secondary">{(game.gameStatusText || "").trim() || (game.gameStatus === 3 ? "Final" : "Scheduled")}</span>
                  </div>
                  <p className="text-xs text-text-secondary mt-1">
                    {game.awayTeam.teamCity} {game.awayTeam.teamName} @ {game.homeTeam.teamCity} {game.homeTeam.teamName}
                  </p>
                </button>
              ))}
              {games.length === 0 && !loading && (
                <p className="text-sm text-text-secondary text-center py-4">No games on this date</p>
              )}
            </div>
          )}
        </div>

        <div>
          {selectedGame ? (
            <>
              <h2 className="text-sm font-medium text-text-secondary mb-3">
                Replay Links — {selectedGame.awayTeam.teamTricode} vs {selectedGame.homeTeam.teamTricode}
              </h2>
              <div className="space-y-2 mb-4">
                {replayLinks.map((link) => (
                  <div key={link.id} className="bg-bg-card rounded-lg border border-border p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Play size={14} className="text-accent shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{link.title}</p>
                        <p className="text-xs text-text-secondary truncate">{link.url}</p>
                      </div>
                      <span className="text-xs bg-bg-hover px-1.5 py-0.5 rounded shrink-0">{link.source}</span>
                    </div>
                    <button onClick={() => removeLink(link.id)} className="p-1.5 text-text-secondary hover:text-danger transition-colors shrink-0 ml-2">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {replayLinks.length === 0 && <p className="text-sm text-text-secondary text-center py-4">No replay links yet</p>}
              </div>

              <form onSubmit={addLink} className="bg-bg-card rounded-xl border border-border p-4 space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-1.5">
                  <Plus size={14} />
                  Add Replay Link
                </h3>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Title (e.g. Full Game Replay)"
                  className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
                  required
                />
                <input
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="URL (e.g. https://...)"
                  className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
                  required
                />
                <select
                  value={newSource}
                  onChange={(e) => setNewSource(e.target.value)}
                  className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="cloud">Cloud Drive</option>
                  <option value="youtube">YouTube</option>
                  <option value="bilibili">Bilibili</option>
                  <option value="other">Other</option>
                </select>
                <button type="submit" className="w-full bg-accent hover:bg-accent-hover text-white font-medium py-2 rounded-lg text-sm transition-colors">
                  Add Link
                </button>
              </form>
            </>
          ) : (
            <div className="flex items-center justify-center py-16 text-text-secondary text-sm">
              Select a game to manage replay links
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
