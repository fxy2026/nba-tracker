import Image from "next/image";
import Link from "next/link";
import { getPlayerInfo, getPlayerHeadshotUrl } from "@/lib/api";
import { notFound } from "next/navigation";
import { Ruler, Weight, MapPin, GraduationCap, Calendar, Award, ExternalLink, Newspaper } from "lucide-react";
import PlayerMeasurements from "@/components/player/PlayerMeasurements";
import PlayerSalary from "@/components/player/PlayerSalary";
import PlayerNews from "@/components/player/PlayerNews";
import PlayerStatsBundle from "@/components/player/PlayerStatsBundle";

// Revalidate every 5 minutes
export const revalidate = 300;

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
  const fullName = `${player.firstName} ${player.lastName}`;
  const seasons = player.toYear && player.fromYear ? parseInt(player.toYear) - parseInt(player.fromYear) + 1 : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <Link href="/search" className="text-sm text-text-secondary hover:text-accent transition-colors">
        &larr; Back to search
      </Link>

      {/* Player Header */}
      <div className="bg-bg-card rounded-xl border border-border mt-4 overflow-hidden">
        <div className="relative bg-gradient-to-r from-accent/10 via-bg-card to-bg-card p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-bg-secondary border-4 border-accent/20 shrink-0">
              <Image
                src={headshotUrl}
                alt={fullName}
                width={128}
                height={128}
                className="w-full h-full object-cover object-top"
              />
            </div>
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
            </div>
          </div>
        </div>

        {/* Body Metrics */}
        <div className="p-6 border-t border-border">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-4 flex items-center gap-2">
            <Ruler size={14} />
            Body Metrics
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard icon={<Ruler size={14} className="text-accent" />} label="Height" value={player.height || "-"} />
            <MetricCard icon={<Weight size={14} className="text-accent" />} label="Weight" value={player.weight ? `${player.weight} lbs` : "-"} />
            <MetricCard icon={<MapPin size={14} className="text-accent" />} label="Country" value={player.country || "-"} />
            <MetricCard icon={<Calendar size={14} className="text-accent" />} label="Seasons" value={seasons > 0 ? `${seasons} years` : "-"} />
          </div>
        </div>

        {/* Draft Info */}
        <div className="p-6 border-t border-border">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-4 flex items-center gap-2">
            <Award size={14} />
            Draft Info
          </h2>
          {player.draftYear ? (
            <div className="bg-bg-secondary rounded-xl p-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="text-center">
                  <p className="text-3xl font-bold text-accent">{player.draftYear}</p>
                  <p className="text-xs text-text-secondary">Year</p>
                </div>
                <div className="w-px h-12 bg-border" />
                <div className="text-center">
                  <p className="text-3xl font-bold text-text-primary">R{player.draftRound}</p>
                  <p className="text-xs text-text-secondary">Round</p>
                </div>
                <div className="w-px h-12 bg-border" />
                <div className="text-center">
                  <p className="text-3xl font-bold text-text-primary">#{player.draftNumber}</p>
                  <p className="text-xs text-text-secondary">Pick</p>
                </div>
                {player.college && (
                  <>
                    <div className="w-px h-12 bg-border" />
                    <div className="flex items-center gap-2">
                      <GraduationCap size={16} className="text-text-secondary" />
                      <div>
                        <p className="text-sm font-medium text-text-primary">{player.college}</p>
                        <p className="text-xs text-text-secondary">College</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-bg-secondary rounded-xl p-4 text-center">
              <p className="text-text-secondary text-sm">Undrafted</p>
              {player.college && <p className="text-xs text-text-secondary mt-1">College: {player.college}</p>}
            </div>
          )}
        </div>

        {/* Career Stats */}
        <div className="p-6 border-t border-border">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-4">Career Averages</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            <StatBox label="PPG" value={player.pts} highlight />
            <StatBox label="RPG" value={player.reb} />
            <StatBox label="APG" value={player.ast} />
            <StatBox label="From" value={player.fromYear || "-"} />
            <StatBox label="To" value={player.toYear || "-"} />
          </div>
        </div>

        {/* External Links */}
        <div className="p-6 border-t border-border">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-4 flex items-center gap-2">
            <Newspaper size={14} />
            More Info & News
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ExternalLinkCard
              title="Player Profile"
              subtitle="Full career stats on NBA.com"
              href={`https://www.nba.com/player/${personId}`}
            />
            <ExternalLinkCard
              title="Salary & Contract"
              subtitle="Cap info on Spotrac"
              href={`https://www.spotrac.com/nba/player/_/id/${personId}`}
            />
            <ExternalLinkCard
              title="Latest News"
              subtitle="Search recent articles"
              href={`https://www.google.com/search?q=${encodeURIComponent(fullName)}+NBA+news&tbm=nws`}
            />
            <ExternalLinkCard
              title="Stats & Analytics"
              subtitle="Advanced data on Basketball Reference"
              href={`https://www.basketball-reference.com/search/search.fcgi?search=${encodeURIComponent(fullName)}`}
            />
          </div>
        </div>

        {/* Dynamic data sections (client-fetched) */}
        <div className="p-6 border-t border-border space-y-6">
          <PlayerSalary playerName={fullName} teamAbbr={player.teamAbbr} />
          <PlayerMeasurements draftYear={player.draftYear} />
          <PlayerNews playerName={fullName} />
          <PlayerStatsBundle playerId={personId} />
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

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-bg-secondary rounded-lg p-3 flex items-center gap-3">
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-[10px] text-text-secondary uppercase">{label}</p>
        <p className="text-sm font-medium text-text-primary">{value}</p>
      </div>
    </div>
  );
}

function ExternalLinkCard({ title, subtitle, href }: { title: string; subtitle: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-4 py-3 bg-bg-secondary rounded-lg hover:bg-bg-hover transition-colors group"
    >
      <ExternalLink size={14} className="text-text-secondary group-hover:text-accent shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors">{title}</p>
        <p className="text-xs text-text-secondary truncate">{subtitle}</p>
      </div>
    </a>
  );
}
