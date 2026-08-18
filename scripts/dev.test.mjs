import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { formatDevBanner, listDevApps } from "./lib/apps.mjs";

test("lists apps with their local URLs", async (context) => {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), "astro-dev-"));
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
  await mkdir(path.join(rootDirectory, "apps", "site"), { recursive: true });
  await writeFile(
    path.join(rootDirectory, "apps", "site", "package.json"),
    JSON.stringify({ name: "site" }),
  );
  await writeFile(
    path.join(rootDirectory, "apps", "site", "astro.config.mjs"),
    "server: { port: 4321 }\n",
  );

  const apps = await listDevApps(rootDirectory);
  assert.deepEqual(
    apps.map(({ name, port, url }) => ({ name, port, url })),
    [
      { name: "site", port: 4321, url: "http://localhost:4321" },
      { name: "notes", port: 4322, url: "http://localhost:4322" },
    ],
  );

  const banner = formatDevBanner(apps);
  assert.match(banner, /Dev servers/);
  assert.match(banner, /site\s+http:\/\/localhost:4321/);
  assert.match(banner, /notes\s+http:\/\/localhost:4322/);
});
