import { getOfficialGameReport } from "@/lib/official-game-reports";

export default function OfficialGameReport({ gameId, isZh }: { gameId: string; isZh: boolean }) {
  const url = getOfficialGameReport(gameId);
  if (!url) return null;
  return (
    <p className="mt-4 text-center text-sm">
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-4">
        {isZh ? "查看 NBA 官方技术统计报告（PDF，外部链接）" : "View NBA official box-score report (external PDF)"} ↗
      </a>
    </p>
  );
}
