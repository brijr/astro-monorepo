import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { formatWorkersBuilds, listDevApps } from "./lib/apps.mjs";
import { removeSite } from "./site.mjs";

test("lists worker names and prints a Builds recipe", async (context) => {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), "astro-sites-"));
  context.after(() => rm(rootDirectory, { recursive: true, force: true }));

  await mkdir(path.join(rootDirectory, "apps", "notes"), { recursive: true });
  await writeFile(
    path.join(rootDirectory, "apps", "notes", "package.json"),
    JSON.stringify({ name: "notes" }),
  );
  await writeFile(
    path.join(rootDirectory, "apps", "notes", "astro.config.mjs"),
    "server: { port: 4322 }\n",
  );
  await writeFile(
    path.join(rootDirectory, "apps", "notes", "wrangler.jsonc"),
    '{ "name": "notes" }\n',
  );

  const [app] = await listDevApps(rootDirectory);
  assert.equal(app.worker, "notes");
  assert.match(formatWorkersBuilds(app), /Root directory\s+apps\/notes/);
});

test("removes an app and refuses the template name", async (context) => {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), "astro-rm-"));
  context.after(() => rm(rootDirectory, { recursive: true, force: true }));

  await mkdir(path.join(rootDirectory, "apps", "notes"), { recursive: true });
  await writeFile(path.join(rootDirectory, "apps", "notes", "ok.txt"), "ok");

  await removeSite({ name: "notes", rootDirectory });
  await assert.rejects(access(path.join(rootDirectory, "apps", "notes")), {
    code: "ENOENT",
  });
  await assert.rejects(
    removeSite({ name: "site-starter", rootDirectory }),
    /template/,
  );
});
