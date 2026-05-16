import type { Metadata } from "next";
import GlossarySearchable from "./GlossarySearchable";

export const metadata: Metadata = {
  title: "Glossary",
  description: "NBA terminology, stat definitions, and concepts explained — from PPG to PER, B2B to BORD.",
};

export default function GlossaryPage() {
  return <GlossarySearchable />;
}
