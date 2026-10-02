import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

it("keeps archive/data-loader runtime imports out of client modules", () => {
  const root = resolve("src");
  const offenders: string[] = [];
  const isApi = (value: string, file: string) => value === "@/lib/api" || value === "@/lib/api.ts" || (value.startsWith(".") && resolve(dirname(file), value).replace(/\.tsx?$/, "") === join(root, "lib/api"));
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
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && isApi(node.moduleSpecifier.text, file)) {
          const clause = node.importClause;
          const namedTypesOnly = clause?.namedBindings && ts.isNamedImports(clause.namedBindings) && clause.namedBindings.elements.every((element) => element.isTypeOnly);
          if (!clause?.isTypeOnly && (clause?.name || !namedTypesOnly)) offenders.push(file);
        }
        if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require")) && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && isApi(node.arguments[0].text, file)) offenders.push(file);
        ts.forEachChild(node, visit);
      }
      visit(parsed);
    }
  }
  scan(root);
  expect(offenders).toEqual([]);
});
