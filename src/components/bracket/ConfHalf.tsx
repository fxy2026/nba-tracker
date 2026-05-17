"use client";

import type { Series } from "@/lib/playoffs";
import SeriesCard from "./SeriesCard";
import { Connector, RoundLabel } from "./Connector";

/**
 * Render one half of the bracket using a SINGLE CSS Grid:
 * 5 columns: [R1 cards] [R1→R2 connector] [R2 cards] [R2→R3 connector] [R3 card]
 * Row 1: round headers (so columns are guaranteed wide enough for labels).
 * Rows 2-9 (8 rows): R1 cards span 2 rows each, R2 spans 4, R3 spans 8.
 *
 * For West (right side), card order is flipped (R3 on left, R1 on right) so the
 * bracket flows inward toward the centered Finals card.
 *
 * Card columns use minmax(170px, 1fr) so they never collapse; the whole bracket
 * sits inside an overflow-x-auto wrapper with min-width so it always renders.
 */
export default function ConfHalf({
  r1, r2, r3,
  side,
  championPath,
  conferenceColor,
  conferenceLabel,
  roundLabels,
}: {
  r1: Series[];
  r2: Series[];
  r3: Series[];
  side: "left" | "right";
  championPath: Set<string>;
  conferenceColor: string;
  conferenceLabel: string;
  roundLabels: Record<number, string>;
}) {
  const isLeft = side === "left";

  // Display order matches actual NBA bracket pairing.
  // R2.0 (top R2) = R1.0 + R1.3, so they must appear as displayR1[0] & [1].
  // R2.1 (bottom R2) = R1.1 + R1.2, so they must appear as displayR1[2] & [3].
  // Top→bottom visual order: 1v8, 4v5, 3v6, 2v7 → series indices [0, 3, 2, 1].
  // West mirrors with offset 4 → [4, 7, 6, 5].
  const r1Order = isLeft ? [0, 3, 2, 1] : [4, 7, 6, 5];
  const displayR1 = r1Order
    .map((idx) => r1.find((s) => s.seriesIndex === idx))
    .filter((s): s is Series => !!s);
  const displayR2 = [...r2].sort((a, b) => a.seriesIndex - b.seriesIndex);
  const displayR3 = [...r3].sort((a, b) => a.seriesIndex - b.seriesIndex);

  // Tight enough to fit ~990px wide for narrow viewports; gutters compact but still visible.
  const gridCols = isLeft
    ? "minmax(120px, 1fr) 28px minmax(125px, 1fr) 28px minmax(135px, 1fr)"
    : "minmax(135px, 1fr) 28px minmax(125px, 1fr) 28px minmax(120px, 1fr)";

  const cardWrap = "flex items-center";

  return (
    <div className="relative">
      {/* Conference badge */}
      <div className={`mb-3 ${isLeft ? "" : "text-right"}`}>
        <span
          className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.25em] px-2.5 py-1 rounded-md border"
          style={{
            background: `color-mix(in srgb, ${conferenceColor} 10%, transparent)`,
            borderColor: `color-mix(in srgb, ${conferenceColor} 30%, transparent)`,
            color: conferenceColor,
          }}
        >
          {isLeft && <span className="w-1.5 h-1.5 rounded-full" style={{ background: conferenceColor }} />}
          {conferenceLabel}
          {!isLeft && <span className="w-1.5 h-1.5 rounded-full" style={{ background: conferenceColor }} />}
        </span>
      </div>

      {/* Single unified grid — headers in row 1, cards/connectors in rows 2-9.
          Row min-height bumped from 54→72 so R1 pairs breathe; gap-y-2 (8px)
          puts visible vertical breathing room between adjacent cards. */}
      <div className="grid gap-x-1 gap-y-2" style={{
        gridTemplateColumns: gridCols,
        gridTemplateRows: "auto repeat(8, minmax(72px, auto))",
      }}>
        {/* Round headers — row 1 */}
        {isLeft ? (
          <>
            <div style={{ gridColumn: "1 / 2", gridRow: "1 / 2" }}>
              <RoundLabel label={roundLabels[1]} sub="Round 1" color="#94A3B8" count={displayR1.length} />
            </div>
            <div style={{ gridColumn: "3 / 4", gridRow: "1 / 2" }}>
              <RoundLabel label={roundLabels[2]} sub="Round 2" color="#94A3B8" count={r2.length} />
            </div>
            <div style={{ gridColumn: "5 / 6", gridRow: "1 / 2" }}>
              <RoundLabel label={roundLabels[3]} sub="Conference Final" color={conferenceColor} count={r3.length} />
            </div>
          </>
        ) : (
          <>
            <div style={{ gridColumn: "1 / 2", gridRow: "1 / 2" }}>
              <RoundLabel label={roundLabels[3]} sub="Conference Final" color={conferenceColor} count={r3.length} />
            </div>
            <div style={{ gridColumn: "3 / 4", gridRow: "1 / 2" }}>
              <RoundLabel label={roundLabels[2]} sub="Round 2" color="#94A3B8" count={r2.length} />
            </div>
            <div style={{ gridColumn: "5 / 6", gridRow: "1 / 2" }}>
              <RoundLabel label={roundLabels[1]} sub="Round 1" color="#94A3B8" count={displayR1.length} />
            </div>
          </>
        )}

        {/* R1 cards — rows 2-9, each spans 2 rows */}
        {displayR1.map((s, i) => (
          <div
            key={s.id}
            className={cardWrap}
            style={{
              gridColumn: isLeft ? "1 / 2" : "5 / 6",
              gridRow: `${i * 2 + 2} / ${i * 2 + 4}`,
            }}
          >
            <SeriesCard s={s} size="sm" onPath={championPath.has(s.id)} align={isLeft ? "left" : "right"} />
          </div>
        ))}

        {/* R1 → R2 connectors */}
        {displayR2.length > 0 && displayR1.length === 4 && [0, 1].map((pairIdx) => {
          const r2Match = displayR2[pairIdx];
          const highlight = r2Match && championPath.has(r2Match.id);
          return (
            <div
              key={`r1r2-${pairIdx}`}
              className="relative"
              style={{
                gridColumn: isLeft ? "2 / 3" : "4 / 5",
                gridRow: pairIdx === 0 ? "2 / 6" : "6 / 10",
              }}
            >
              <Connector side={side} highlight={highlight} />
            </div>
          );
        })}

        {/* R2 cards */}
        {displayR2.map((s, i) => (
          <div
            key={s.id}
            className={cardWrap}
            style={{
              gridColumn: "3 / 4",
              gridRow: `${i * 4 + 2} / ${i * 4 + 6}`,
            }}
          >
            <SeriesCard s={s} size="sm" onPath={championPath.has(s.id)} align={isLeft ? "left" : "right"} />
          </div>
        ))}

        {/* R2 → R3 connector */}
        {displayR3.length > 0 && displayR2.length === 2 && (
          <div
            className="relative"
            style={{
              gridColumn: isLeft ? "4 / 5" : "2 / 3",
              gridRow: "2 / 10",
            }}
          >
            <Connector side={side} highlight={championPath.has(displayR3[0].id)} />
          </div>
        )}

        {/* R3 card */}
        {displayR3.map((s) => (
          <div
            key={s.id}
            className={cardWrap}
            style={{
              gridColumn: isLeft ? "5 / 6" : "1 / 2",
              gridRow: "2 / 10",
            }}
          >
            <SeriesCard s={s} size="md" onPath={championPath.has(s.id)} align={isLeft ? "left" : "right"} />
          </div>
        ))}
      </div>
    </div>
  );
}
