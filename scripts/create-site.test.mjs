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
  createSite,
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

  const siteTs = await readFile(path.join(destination, "src/site.ts"), "utf8");
  assert.match(siteTs, /name: "Field Notes"/);
  assert.match(siteTs, /url: "https:\/\/field-notes\.example"/);
  assert.doesNotMatch(siteTs, /Site Starter|site-starter/);

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
});
