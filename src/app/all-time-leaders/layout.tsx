import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "All-Time NBA Leaders · Career PPG, RPG, APG",
  description: "The top 25 NBA career leaders across points, rebounds, assists, and longevity — derived from the official NBA player index covering both active and retired players.",
  openGraph: {
    title: "All-Time NBA Leaders",
    description: "Career averages across PPG / RPG / APG / tenure — Hall-of-Fame caliber rankings",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
