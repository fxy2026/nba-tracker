import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

it("keeps API and shared-contract runtime imports out of client modules", () => {
  const root = resolve("src");
  const offenders: string[] = [];
  const isProtectedModule = (value: string, file: string) => ["api", "nba-contracts"].some((name) =>
    value === `@/lib/${name}` || value === `@/lib/${name}.ts` ||
    (value.startsWith(".") && resolve(dirname(file), value).replace(/\.tsx?$/, "") === join(root, `lib/${name}`))
  );
  function scan(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) { scan(file); continue; }
      if (!/\.tsx?$/.test(file)) continue;
      const source = readFileSync(file, "utf8");
      if (!source.includes("use client")) continue;
      const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
      const client = parsed.statements.some((statement) => ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression) && statement.expression.text === "use client");
      if (!client) continue;
      function visit(node: ts.Node) {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && isProtectedModule(node.moduleSpecifier.text, file)) {
          const clause = node.importClause;
          const namedTypesOnly = clause?.namedBindings && ts.isNamedImports(clause.namedBindings) && clause.namedBindings.elements.length > 0 && clause.namedBindings.elements.every((element) => element.isTypeOnly);
          if (!clause?.isTypeOnly && (clause?.name || !namedTypesOnly)) offenders.push(file);
        }
        if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require")) && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && isProtectedModule(node.arguments[0].text, file)) offenders.push(file);
        ts.forEachChild(node, visit);
      }
      visit(parsed);
    }
  }
  scan(root);
  expect(offenders).toEqual([]);
});

// A contracts module must stay safe to import from either side of the boundary:
// no loaders, data files, environment access, UI dependencies, or runtime values.
function contractBoundaryViolations(source: string): string[] {
  const parsed = ts.createSourceFile("nba-contracts.ts", source, ts.ScriptTarget.Latest, true);
  const violations: string[] = [];
  for (const statement of parsed.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      const names = clause?.namedBindings;
      if (!clause?.isTypeOnly || clause.name || !names || !ts.isNamedImports(names) ||
        names.elements.length !== 1 || names.elements[0].propertyName || names.elements[0].name.text !== "PlayerIndexProvenance" ||
        !ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== "./player-index-provenance") {
        violations.push("Only the PlayerIndexProvenance type dependency is allowed");
      }
    } else if (!(ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) ||
      !statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      violations.push("Only exported interfaces and type aliases are allowed");
    }
  }
  function visit(node: ts.Node) {
    // Inline imports can bypass top-level import checks, and typeof can couple
    // otherwise erased declarations to runtime/environment/UI values.
    if (ts.isImportTypeNode(node) || ts.isTypeQueryNode(node)) {
      violations.push("Contracts cannot reference external modules or runtime values through types");
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  return violations;
}

it("keeps shared NBA contracts type-only with one explicit type dependency", () => {
  const source = readFileSync(resolve("src/lib/nba-contracts.ts"), "utf8");
  expect(contractBoundaryViolations(source)).toEqual([]);
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2017, removeComments: true },
  }).outputText;
  expect(output.trim()).toBe("export {};");
});

it.each([
  'import "./api";',
  'import { playerIndexLabel } from "./player-index-provenance";',
  'import type { PlayerInfo } from "./api";',
  'import type data from "@/data/playerindex-2025-26.json";',
  'import type { ComponentProps } from "react";',
  'import type { GameCard } from "@/components/GameCard";',
  'export { getTodayScoreboard } from "./api";',
  'export type { PlayerInfo } from "./api";',
  'export const value = process.env.NBA_API_KEY;',
  'export enum GameStatus { Final = 3 }',
  'export type Environment = typeof process.env;',
  'export type Player = import("./api").PlayerInfo;',
])("rejects contracts boundary violation: %s", (source) => {
  expect(contractBoundaryViolations(source).length).toBeGreaterThan(0);
});
