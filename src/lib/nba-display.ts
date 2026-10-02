// Client-safe presentation helpers. Do not import schedules or data loaders here.
import { playerHeadshotUrl } from "./teamUrls";

// Player headshot URL
export function getPlayerHeadshotUrl(personId: number): string {
  return playerHeadshotUrl(personId);
}

// ========== Helpers ==========

// Format date in US/Eastern timezone (NBA schedule uses ET dates)
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// Convert UTC time to Beijing time display string
export function toBeijingTime(utcStr: string): string {
  if (!utcStr) return "";
  const d = new Date(utcStr);
  return d.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// Parse NBA minutes format "PT33M50.00S" to "33:50"
export function parseMinutes(min: string): string {
  if (!min || min === "PT00M00.00S") return "-";
  const match = min.match(/PT(\d+)M([\d.]+)S/);
  if (!match) return min;
  const m = match[1];
  const s = Math.floor(parseFloat(match[2]));
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Get game status display
export function getGameStatusDisplay(status: number, statusText: string): string {
  const text = statusText.trim();
  if (status === 3) return "Final";
  if (status === 2) return text || "Live";
  return text || "Scheduled";
}
