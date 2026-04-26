"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DateNavProps {
  selectedDate: string;
}

export default function DateNav({ selectedDate }: DateNavProps) {
  const router = useRouter();

  const currentDate = new Date(selectedDate + "T12:00:00");

  const goToDate = (offset: number) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + offset);
    const dateStr = d.toISOString().split("T")[0];
    router.push(`/?date=${dateStr}`);
  };

  // Generate 7 days centered around selected date
  const days: { date: string; label: string; weekday: string }[] = [];
  for (let i = -3; i <= 3; i++) {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    days.push({
      date: dateStr,
      label: d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }),
      weekday: d.toLocaleDateString("zh-CN", { weekday: "short" }),
    });
  }

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        onClick={() => goToDate(-1)}
        className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
      >
        <ChevronLeft size={20} />
      </button>

      <div className="flex gap-1 overflow-x-auto">
        {days.map((day) => {
          const isSelected = day.date === selectedDate;
          const isToday = day.date === today;
          return (
            <button
              key={day.date}
              onClick={() => router.push(`/?date=${day.date}`)}
              className={`flex flex-col items-center px-3 py-2 rounded-lg text-xs font-medium transition-colors min-w-[56px] ${
                isSelected
                  ? "bg-accent text-white"
                  : isToday
                  ? "bg-accent/15 text-accent hover:bg-accent/25"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              <span>{day.weekday}</span>
              <span className="text-sm mt-0.5">{day.label}</span>
            </button>
          );
        })}
      </div>

      <button
        onClick={() => goToDate(1)}
        className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
      >
        <ChevronRight size={20} />
      </button>

      {selectedDate !== today && (
        <button
          onClick={() => router.push(`/?date=${today}`)}
          className="ml-2 px-3 py-1.5 text-xs bg-bg-card border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-accent/50 transition-colors"
        >
          今天
        </button>
      )}
    </div>
  );
}
