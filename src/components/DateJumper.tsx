"use client";

import { useRouter } from "next/navigation";

export default function DateJumper() {
  const router = useRouter();
  return (
    <div className="mb-4 flex items-center gap-3">
      <label htmlFor="date-jump" className="text-xs text-text-secondary font-medium">Jump to date:</label>
      <input
        type="date"
        id="date-jump"
        defaultValue={new Date().toISOString().slice(0, 10)}
        onChange={(e) => { if (e.target.value) router.push(`/?date=${e.target.value}`); }}
        className="bg-bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
      />
    </div>
  );
}
