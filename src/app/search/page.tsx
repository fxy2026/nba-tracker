import { Search } from "lucide-react";
import SearchInput from "@/components/SearchInput";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Search size={24} className="text-accent" />
        Player Search
      </h1>
      <SearchInput initialQuery={q || ""} />
      <p className="text-center text-xs text-text-secondary mt-6">
        Search by player name to view detailed stats and profiles
      </p>
    </div>
  );
}
