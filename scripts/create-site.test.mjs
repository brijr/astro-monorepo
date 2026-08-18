import assert from "node:assert/strict";
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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
