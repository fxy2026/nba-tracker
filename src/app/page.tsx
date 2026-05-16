import { formatDate } from "@/lib/api";
import HomeClient from "@/components/HomeClient";

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

// Dynamic page — reads searchParams for date navigation
export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const today = formatDate(new Date());
  const initialDate = params.date || today;

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-mesh-aurora pointer-events-none -z-10" />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <HomeClient initialDate={initialDate} />
      </div>
    </div>
  );
}
