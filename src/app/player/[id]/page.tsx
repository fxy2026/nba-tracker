import Image from "next/image";
import Link from "next/link";
import { getPlayerInfo, getPlayerHeadshotUrl } from "@/lib/api";
import { TEAM_META } from "@/lib/teams";
import { notFound } from "next/navigation";
import { User } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PlayerPage({ params }: PageProps) {
  const { id } = await params;
  const personId = parseInt(id, 10);
  if (isNaN(personId)) notFound();

  const player = await getPlayerInfo(personId);
  if (!player) notFound();

  const headshotUrl = getPlayerHeadshotUrl(personId);
  const teamMeta = TEAM_META[player.teamAbbr];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <Link href="/search" className="text-sm text-text-secondary hover:text-accent transition-colors">
        &larr; Back to search
      </Link>

      {/* Player Header */}
      <div className="bg-bg-card rounded-xl border border-border mt-4 overflow-hidden">
        <div className="relative bg-gradient-to-r from-accent/10 via-bg-card to-bg-card p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Headshot */}
            <div className="w-32 h-32 rounded-full overflow-hidden bg-bg-secondary border-4 border-accent/20 shrink-0">
              <Image
                src={headshotUrl}
                alt={`${player.firstName} ${player.lastName}`}
                width={128}
                height={128}
                className="w-full h-full object-cover object-top"
              />
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-3xl font-bold">
                {player.firstName} <span className="text-accent">{player.lastName}</span>
              </h1>
              <div className="flex items-center justify-center sm:justify-start gap-3 mt-2 flex-wrap">
                <Link
                  href={`/team/${player.teamAbbr}`}
                  className="text-sm text-text-secondary hover:text-accent transition-colors"
                >
                  {player.teamCity} {player.teamName}
                </Link>
                <span className="text-accent font-medium text-sm">#{player.jersey} &middot; {player.position}</span>
              </div>
              <div className="flex items-center justify-center sm:justify-start gap-4 mt-3 text-sm text-text-secondary">
                {player.height && <span>{player.height}</span>}
                {player.weight && <span>{player.weight} lbs</span>}
                {player.country && <span>{player.country}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Career Stats */}
        <div className="p-6 border-t border-border">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-4">Career Averages</h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            <StatBox label="PPG" value={player.pts} highlight />
            <StatBox label="RPG" value={player.reb} />
            <StatBox label="APG" value={player.ast} />
            <StatBox label="Seasons" value={player.toYear && player.fromYear ? parseInt(player.toYear) - parseInt(player.fromYear) + 1 : "-"} />
            <StatBox label="From" value={player.fromYear || "-"} />
            <StatBox label="To" value={player.toYear || "-"} />
          </div>
        </div>

        {/* Draft & Bio */}
        <div className="p-6 border-t border-border">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-4">Background</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {player.college && (
              <InfoRow label="College" value={player.college} />
            )}
            {player.draftYear && (
              <InfoRow label="Draft" value={`${player.draftYear} · Round ${player.draftRound} · Pick ${player.draftNumber}`} />
            )}
            {!player.draftYear && (
              <InfoRow label="Draft" value="Undrafted" />
            )}
            {player.country && (
              <InfoRow label="Country" value={player.country} />
            )}
            {teamMeta && (
              <InfoRow label="Conference" value={`${teamMeta.conference}ern · ${teamMeta.division}`} />
            )}
          </div>
        </div>

        {/* Team Link */}
        {player.teamAbbr && (
          <div className="p-6 border-t border-border">
            <Link
              href={`/team/${player.teamAbbr}`}
              className="flex items-center gap-3 px-4 py-3 bg-bg-hover rounded-lg hover:bg-accent/10 transition-colors group"
            >
              <Image
                src={`https://cdn.nba.com/logos/nba/${player.teamId}/global/L/logo.svg`}
                alt={player.teamAbbr}
                width={32}
                height={32}
                unoptimized
              />
              <div>
                <p className="font-medium text-text-primary group-hover:text-accent transition-colors">
                  {player.teamCity} {player.teamName}
                </p>
                <p className="text-xs text-text-secondary">View team roster & schedule</p>
              </div>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="bg-bg-secondary rounded-lg p-3 text-center">
      <p className="text-[10px] text-text-secondary uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold mt-1 ${highlight ? "text-accent" : "text-text-primary"}`}>{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <User size={14} className="text-text-secondary shrink-0" />
      <div>
        <p className="text-xs text-text-secondary">{label}</p>
        <p className="text-sm text-text-primary">{value}</p>
      </div>
    </div>
  );
}
