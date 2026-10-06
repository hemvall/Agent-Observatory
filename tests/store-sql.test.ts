import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";
const source = readFileSync(
  new URL("../lib/observatory/store.ts", import.meta.url),
  "utf8",
);
const syntax = ts.createSourceFile(
  "store.ts",
  source,
  ts.ScriptTarget.Latest,
  true,
);
const queries: string[] = [];
function visit(node: ts.Node) {
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "prepare" &&
    node.arguments[0] &&
    ts.isStringLiteral(node.arguments[0])
  )
    queries.push(node.arguments[0].text);
  ts.forEachChild(node, visit);
}
visit(syntax);
function query(prefix: string) {
  const sql = queries.find((value) => value.startsWith(prefix));
  assert.ok(sql, `Missing SQL query: ${prefix}`);
  return sql;
}
function db() {
  const database = new DatabaseSync(":memory:");
  for (const name of readdirSync(new URL("../drizzle", import.meta.url)).filter(
    (n) => n.endsWith(".sql"),
  ))
    database.exec(
      readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8"),
    );
  database
    .prepare(query("INSERT"))
    .run("r1", JSON.stringify({ status: "running" }), "2026-01-01");
  return database;
}
test("lease acquisition prevents a second concurrent step and allows expired-lease recovery", () => {
  const database = db();
  try {
    const lease = database.prepare(
      query("UPDATE runs SET revision = revision + 1"),
    );
    assert.equal(Number(lease.run(200, "r1", 0, 100).changes), 1);
    assert.equal(Number(lease.run(300, "r1", 0, 100).changes), 0);
    assert.equal(Number(lease.run(300, "r1", 1, 150).changes), 0);
    assert.equal(Number(lease.run(400, "r1", 1, 250).changes), 1);
  } finally {
    database.close();
  }
});
test("a paused revision cannot be overwritten by an in-flight completion", () => {
  const database = db();
  try {
    database
      .prepare(query("UPDATE runs SET revision = revision + 1"))
      .run(200, "r1", 0, 100);
    const update = database.prepare(query("UPDATE runs SET data"));
    assert.equal(
      Number(
        update.run(
          JSON.stringify({ status: "paused" }),
          2,
          "2026-01-02",
          0,
          "r1",
          1,
        ).changes,
      ),
      1,
    );
    assert.equal(
      Number(
        update.run(
          JSON.stringify({ status: "running" }),
          2,
          "2026-01-02",
          0,
          "r1",
          1,
        ).changes,
      ),
      0,
    );
    const row = database
      .prepare(query("SELECT * FROM runs WHERE"))
      .get("r1") as { data: string };
    assert.equal(JSON.parse(row.data).status, "paused");
  } finally {
    database.close();
  }
});
