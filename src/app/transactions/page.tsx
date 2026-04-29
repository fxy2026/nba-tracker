"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface Transaction {
  date: string;
  team: string;
  teamAbbr: string;
  player: string;
  type: string;
  description: string;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/transactions")
      .then((r) => r.json())
      .then((data) => {
        setTransactions(data.transactions || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Group by date
  const grouped = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const dateKey = t.date ? new Date(t.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Unknown Date";
    const arr = grouped.get(dateKey) || [];
    arr.push(t);
    grouped.set(dateKey, arr);
  }

  // Sort dates descending
  const sortedDates = [...grouped.keys()].sort((a, b) => {
    const da = new Date(a).getTime();
    const db = new Date(b).getTime();
    if (isNaN(da) || isNaN(db)) return 0;
    return db - da;
  });

  function getTypeColor(type: string) {
    const lower = type.toLowerCase();
    if (lower.includes("trade")) return "bg-accent/15 text-accent";
    if (lower.includes("sign")) return "bg-success/15 text-success";
    if (lower.includes("waiv")) return "bg-danger/15 text-danger";
    return "bg-bg-hover text-text-secondary";
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Link href="/" className="text-sm text-text-secondary hover:text-accent transition-colors">
        <ArrowLeft size={14} className="inline mr-1" />
        Back to home
      </Link>

      <h1 className="text-2xl font-bold mt-4 mb-6">NBA Transactions</h1>

      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-5 w-40 bg-bg-card rounded mb-2" />
              <div className="h-16 bg-bg-card rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {!loading && transactions.length === 0 && (
        <div className="text-center py-12 text-text-secondary">
          <p className="text-lg">No recent transactions available</p>
          <p className="text-sm mt-1">Check back later for updates</p>
        </div>
      )}

      {!loading && sortedDates.length > 0 && (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-8">
            {sortedDates.map((dateKey) => (
              <div key={dateKey} className="relative pl-10">
                {/* Timeline dot */}
                <div className="absolute left-2.5 top-1 w-3 h-3 rounded-full bg-accent border-2 border-bg-primary z-10" />

                <h2 className="text-sm font-semibold text-text-secondary mb-2">{dateKey}</h2>
                <div className="space-y-2">
                  {grouped.get(dateKey)!.map((t, idx) => (
                    <div
                      key={`${dateKey}-${idx}`}
                      className="bg-bg-card rounded-xl border border-border p-3"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getTypeColor(t.type)}`}>
                          {t.type}
                        </span>
                        <span className="text-sm font-medium text-text-primary">{t.team}</span>
                        {t.teamAbbr && (
                          <span className="text-xs text-text-secondary">({t.teamAbbr})</span>
                        )}
                      </div>
                      {t.player && (
                        <p className="text-sm text-accent font-medium">{t.player}</p>
                      )}
                      {t.description && (
                        <p className="text-xs text-text-secondary mt-1">{t.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
