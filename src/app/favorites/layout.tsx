import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Favorites",
  description: "Your favorite NBA teams and players.",
};

export default function FavoritesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
