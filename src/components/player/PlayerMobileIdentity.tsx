import Link from "next/link";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import FavoriteButton from "@/components/FavoriteButton";
import ShareButton from "@/components/ShareButton";
import styles from "./player-mobile.module.css";
export default function PlayerMobileIdentity({ id, name, subtitle, facts = [], source, teamHref, color = "#3b82f6", locale }: {
  id: number; name: string; subtitle: string; facts?: string[]; source: string; teamHref?: string; color?: string; locale: "zh" | "en";
}) {
  return <header className={styles.identity} style={{ "--player-accent": color } as React.CSSProperties}>
    <div className={styles.identityTop}>
      <Link href="/search" className={styles.back}>{locale === "zh" ? "‹ 球员" : "‹ Players"}</Link>
      <div className={styles.identityActions}><FavoriteButton type="player" id={id} /><ShareButton subject="player" text={`${name} · https://nba.xpy.me/player/${id}`} /></div>
    </div>
    <div className={styles.identityRow}>
      <div className={styles.headshot}><PlayerHeadshot personId={id} name={name} size={88} /></div>
      <div className={styles.identityName}><h1>{name}</h1>{teamHref ? <Link href={teamHref}>{subtitle}</Link> : <p>{subtitle}</p>}{facts.length > 0 && <p className={styles.identityFacts}>{facts.join(" · ")}</p>}</div>
    </div>
    <p className={styles.identitySource}>{source}</p>
  </header>;
}
