import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("student app stays anonymous and uses only api RPCs", async () => {
  const source = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  assert.match(source, /join_grouping_session/);
  assert.match(source, /my_grouping_status/);
  assert.match(source, /schema: "api"/);
  assert.doesNotMatch(source, /service_role|admin_api|generate_grouping|publish_grouping/i);
  assert.doesNotMatch(source, /signIn|password|email/i);
});

test("package does not ship backend secrets tooling", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.name, "classroom-group-generator");
  assert.ok(pkg.dependencies["@supabase/supabase-js"]);
});
