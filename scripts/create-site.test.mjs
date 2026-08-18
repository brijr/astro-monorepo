import assert from "node:assert/strict";
import {
  access,
  cp,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  assignDevPort,
  createSite,
  nextDevPort,
  parseArguments,
  validateSiteInput,
} from "./create-site.mjs";

test("parses required and optional arguments", () => {
  assert.deepEqual(
    parseArguments([
      "field-notes",
      "--url",
      "https://field-notes.example",
      "--title",
      "Field Notes",
    ]),
    {
      name: "field-notes",
      title: "Field Notes",
      url: "https://field-notes.example",
    },
  );
});

test("derives a title and normalizes the URL", () => {
  assert.deepEqual(
    validateSiteInput({ name: "field-notes", url: "https://example.com/" }),
    {
      name: "field-notes",
      title: "Field Notes",
      url: "https://example.com",
    },
  );
});

test("rejects invalid names and URLs", () => {
  assert.throws(
    () =>
      validateSiteInput({ name: "Field Notes", url: "https://example.com" }),
    /kebab-case/,
  );
  assert.throws(
    () =>
      validateSiteInput({
        name: "field-notes",
        url: "http://example.com/path",
      }),
    /HTTPS origin/,
  );
});

test("assigns the next unused local port", async (context) => {
  const appsDirectory = await mkdtemp(path.join(os.tmpdir(), "astro-ports-"));
  context.after(() => rm(appsDirectory, { recursive: true, force: true }));

  assert.equal(await nextDevPort(appsDirectory), 4321);

  await mkdir(path.join(appsDirectory, "site-one"), { recursive: true });
  await writeFile(
    path.join(appsDirectory, "site-one", "astro.config.mjs"),
    "server: { port: 4321 }\n",
  );
  await mkdir(path.join(appsDirectory, "site-two"), { recursive: true });
  await writeFile(
    path.join(appsDirectory, "site-two", "astro.config.mjs"),
    "server: { port: 4322 }\n",
  );

  assert.equal(await nextDevPort(appsDirectory), 4323);
  assert.match(
    assignDevPort(
      'output: "static",\n  server: {\n    port: 4399,\n  },',
      4323,
    ),
    /port: 4323/,
  );
});

test("creates a fully substituted site and rejects collisions", async (context) => {
  const rootDirectory = await mkdtemp(
    path.join(os.tmpdir(), "astro-site-generator-"),
  );
  context.after(() => rm(rootDirectory, { recursive: true, force: true }));

  const templateDirectory = path.join(
    rootDirectory,
    "templates",
    "site-starter",
  );
  await mkdir(templateDirectory, { recursive: true });
  await writeFile(
    path.join(templateDirectory, "fixture.txt"),
    "site-starter|Site Starter|https://site-starter.example.com",
  );
  await mkdir(path.join(templateDirectory, "node_modules"));
  await writeFile(
    path.join(templateDirectory, "node_modules", "ignored.txt"),
    "ignored",
  );

  const destination = await createSite({
    name: "field-notes",
    title: "Field Notes",
    url: "https://field-notes.example",
    rootDirectory,
  });

  assert.equal(
    await readFile(path.join(destination, "fixture.txt"), "utf8"),
    "field-notes|Field Notes|https://field-notes.example",
  );
  await assert.rejects(access(path.join(destination, "node_modules")), {
    code: "ENOENT",
  });

  await assert.rejects(
    createSite({
      name: "field-notes",
      title: "Field Notes",
      url: "https://field-notes.example",
      rootDirectory,
    }),
    /already exists/,
  );
});

test("substitutes identity in the real site-starter template", async (context) => {
  const repoRoot = path.resolve(fileURLToPath(import.meta.url), "..", "..");
  const rootDirectory = await mkdtemp(
    path.join(os.tmpdir(), "astro-site-real-"),
  );
  context.after(() => rm(rootDirectory, { recursive: true, force: true }));

  const ignored = new Set([".astro", ".wrangler", "dist", "node_modules"]);
  await mkdir(path.join(rootDirectory, "templates"), { recursive: true });
  await cp(
    path.join(repoRoot, "templates", "site-starter"),
    path.join(rootDirectory, "templates", "site-starter"),
    {
      recursive: true,
      filter(source) {
        return !source.split(path.sep).some((part) => ignored.has(part));
      },
    },
  );

  const destination = await createSite({
    name: "field-notes",
    title: "Field Notes",
    url: "https://field-notes.example",
    rootDirectory,
  });

  const constants = await readFile(
    path.join(destination, "src/lib/constants.ts"),
    "utf8",
  );
  assert.match(constants, /SITE_NAME = "Field Notes"/);
  assert.match(constants, /SITE_URL = "https:\/\/field-notes\.example"/);
  assert.doesNotMatch(constants, /Site Starter|site-starter/);

  const wrangler = await readFile(
    path.join(destination, "wrangler.jsonc"),
    "utf8",
  );
  assert.match(wrangler, /"name": "field-notes"/);

  const robots = await readFile(
    path.join(destination, "public/robots.txt"),
    "utf8",
  );
  assert.match(robots, /https:\/\/field-notes\.example\/sitemap-index\.xml/);

  const config = await readFile(
    path.join(destination, "astro.config.mjs"),
    "utf8",
  );
  assert.match(config, /port: 4321/);
});
