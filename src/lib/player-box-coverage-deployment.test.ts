import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";
import manifest from "@/data/player-box-coverage.json";
import espn from "@/data/espn-player-boxes/manifest.json";
import historical from "@/data/sixers-2024-25/catalog.json";

function imports(file: string) {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const dependencies: string[] = [];
  for (const node of source.statements) if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
    const clause = node.importClause;
    const typeOnlyNames = clause?.namedBindings && ts.isNamedImports(clause.namedBindings) && clause.namedBindings.elements.every(element => element.isTypeOnly);
    if (!clause?.isTypeOnly && !(typeOnlyNames && !clause.name)) dependencies.push(node.moduleSpecifier.text);
  }
  return dependencies;
}
it("keeps the helper server-only and its runtime inputs restricted to small metadata", () => {
  expect(imports("src/lib/player-box-coverage.ts")).toEqual(["server-only", "@/data/player-box-coverage.json", "./teams"]);
  expect(readFileSync("src/lib/player-box-coverage.ts", "utf8")).not.toMatch(/\bfetch\s*\(|node:fs|node:zlib|readFile|api\/|player-box-archive/);
  expect(imports("src/app/team/[tricode]/_components/TeamArchiveCoverage.tsx")).toEqual([]);
  expect(readFileSync("src/app/team/[tricode]/_components/TeamArchiveCoverage.tsx", "utf8")).not.toContain("use client");
  expect(readFileSync("scripts/recovery/player-box-coverage.ts", "utf8")).not.toMatch(/node:zlib|\b(?:gunzip|inflate|fetch)\w*\s*\(/);
});
it("no client module directly imports coverage, generators or per-game archive metadata", () => {
  const offenders: string[] = [];
  function scan(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) { scan(path); continue; }
      if (!/\.tsx?$/.test(path)) continue;
      const source = readFileSync(path, "utf8");
      if (!/^['"]use client['"];?/m.test(source)) continue;
      const dependencies = imports(path);
      for (const value of dependencies) if (/player-box-coverage|scripts\/recovery|data\/(?:espn-player-boxes|sixers-2024-25|recovered-player-boxes|provider-player-boxes)/.test(value)) offenders.push(`${path}: ${value}`);
    }
  }
  scan("src"); expect(offenders).toEqual([]);
});
// Enable only against a freshly built production artifact, never a stale .next.
it.runIf(process.env.VERIFY_TEAM_COVERAGE_TRACE === "1")("adds no broad source-file tracing or coverage metadata to client chunks", () => {
  const tracePath = resolve(".next/server/app/team/[tricode]/page.js.nft.json");
  const trace = JSON.parse(readFileSync(tracePath, "utf8")) as { files: string[] };
  const files = [...new Set(trace.files.map(file => relative(process.cwd(), resolve(dirname(tracePath), file)).replaceAll("\\", "/")))];
  // Existing historical-route archive readers already trace these exact gzip stores.
  const allowedSources = new Set([
    ...espn.map(entry => `src/data/espn-player-boxes/${entry.file}`),
    ...historical.games.flatMap(game => game.boxEntry ? [`src/data/sixers-2024-25/${game.boxEntry.file}`] : []),
    "src/data/espn-player-boxes/manifest.json", "src/data/sixers-2024-25/catalog.json", "src/data/player-box-coverage.json",
  ]);
  expect(files.filter(file => file.startsWith("src/") && !allowedSources.has(file))).toEqual([]);
  expect(files.filter(file => /scripts\/recovery|archive-coverage-audit|recovered-player-box-provenance|provider-player-boxes\/|recovered-player-boxes\//.test(file))).toEqual([]);
  function scanChunks(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) scanChunks(path);
      else if (entry.name.endsWith(".js")) expect(readFileSync(path, "utf8")).not.toContain(manifest.inputSha256);
    }
  }
  scanChunks(".next/static/chunks");
});
