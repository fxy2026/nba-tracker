import { Search } from "lucide-react";

export default function SearchPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Search</h1>
      <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
        <Search size={48} className="mb-4 opacity-30" />
        <p>Player search coming soon</p>
        <p className="text-sm mt-1">Use the homepage to browse games by date</p>
      </div>
    </div>
  );
}
