"use client";

import { useRouter } from "next/navigation";

export default function DateJumper() {
  const router = useRouter();
  return (
    <div className="mb-5 flex items-center gap-3">
      <label htmlFor="date-jump" className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary">Jump to date</label>
      <input
        type="date"
        id="date-jump"
        defaultValue={new Date().toISOString().slice(0, 10)}
        onChange={(e) => { if (e.target.value) router.push(`/?date=${e.target.value}`); }}
        className="glass-tile px-3 py-1.5 text-sm font-mono tabular-nums text-text-primary focus:outline-none focus:border-accent cursor-pointer"
      />
    </div>
  );
}
