import aliases from "@/data/archive-game-aliases.json";

/** Fixed independently verified identities; never infer an NBA ID from user input. */
export function resolveArchiveGameId(id: string): string {
  return Object.hasOwn(aliases, id) ? (aliases as Record<string, string>)[id] : id;
}
