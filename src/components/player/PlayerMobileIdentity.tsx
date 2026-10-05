import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Database } from "lucide-react";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import FavoriteButton from "@/components/FavoriteButton";
import ShareButton from "@/components/ShareButton";
import { teamLogoUrl } from "@/lib/teamUrls";
import styles from "./player-mobile.module.css";

export default function PlayerMobileIdentity({ id, name, subtitle, facts = [], source, teamHref, teamId, color = "#3b82f6", locale }: {
  id: number; name: string; subtitle: string; facts?: string[]; source: string; teamHref?: string; teamId?: number; color?: string; locale: "zh" | "en";
}) {
  const team = <>{teamId ? <Image src={teamLogoUrl(teamId)} alt="" width={20} height={20} unoptimized /> : null}<span>{subtitle}</span>{teamHref && <ChevronRight size={12} aria-hidden="true" />}</>;
  return <header className={styles.identity} style={{ "--player-accent": color } as React.CSSProperties}>
    <div className={styles.identityTop}>
      <Link href="/search" className={styles.back}><ChevronLeft size={16} aria-hidden="true" />{locale === "zh" ? "球员" : "Players"}</Link>
      <div className={styles.identityActions}><FavoriteButton type="player" id={id} /><ShareButton subject="player" text={`${name} · https://nba.xpy.me/player/${id}`} /></div>
    </div>
    <div className={styles.identityRow}>
      <div className={styles.headshot}><PlayerHeadshot personId={id} name={name} size={96} /></div>
      <div className={styles.identityName}>
        <h1>{name}</h1>
        {teamHref ? <Link href={teamHref} className={styles.team}>{team}</Link> : <p className={styles.team}>{team}</p>}
        {facts.length > 0 && <ul className={styles.identityFacts} aria-label={locale === "zh" ? "球员基本资料" : "Player facts"}>{facts.map((fact, index) => <li key={`${fact}-${index}`}>{fact}</li>)}</ul>}
      </div>
    </div>
    <p className={styles.identitySource}><Database size={11} aria-hidden="true" /><span>{source}</span></p>
  </header>;
}
