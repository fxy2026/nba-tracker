import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NBA Quiz · Guess The Player",
  description: "Test your NBA knowledge with three quiz modes — identify players by headshot, by season stat line, or guess which team they play for. Free trivia game with auto-scoring.",
  openGraph: {
    title: "NBA Quiz · Guess The Player",
    description: "Headshot, stat-line, and team guessing modes · how well do you know the league?",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
