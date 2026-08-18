#!/usr/bin/env node

import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEMPLATE_NAME = "site-starter";
const TEMPLATE_TITLE = "Site Starter";
const TEMPLATE_URL = "https://site-starter.example.com";
const FIRST_DEV_PORT = 4321;
const IGNORED_TEMPLATE_DIRECTORIES = new Set([
  ".astro",
  ".wrangler",
  "dist",
  "node_modules",
]);

function usage() {
  return "Usage: pnpm site:new <kebab-case-name> --url <https-url> [--title <title>]";
}

export function parseArguments(argv) {
  const [name, ...flags] = argv;
  const values = { name, title: undefined, url: undefined };

  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];
    const value = flags[index + 1];

    if ((flag === "--title" || flag === "--url") && value) {
      values[flag.slice(2)] = value;
      index += 1;
      continue;
    }

    throw new Error(
      `Unknown or incomplete option: ${flag ?? "(missing)"}\n${usage()}`,
    );
  }

  return validateSiteInput(values);
}

export function validateSiteInput({ name, title, url }) {
  if (!name || !url) {
    throw new Error(usage());
  }

  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name)) {
    throw new Error("Site name must be kebab-case and begin with a letter.");
  }

  let parsedURL;
  try {
    parsedURL = new URL(url);
  } catch {
    throw new Error("Site URL must be a valid absolute URL.");
  }

  if (
    parsedURL.protocol !== "https:" ||
    parsedURL.username ||
    parsedURL.password ||
    parsedURL.search ||
    parsedURL.hash ||
    parsedURL.pathname !== "/"
  ) {
    throw new Error(
      "Site URL must be an HTTPS origin without a path, query, or hash.",
    );
  }

  const normalizedTitle =
    title?.trim() ||
    name
      .split("-")
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(" ");

  return {
    name,
    title: normalizedTitle,
    url: parsedURL.origin,
  };
}

export function assignDevPort(source, port) {
  if (/\bport:\s*\d+/.test(source)) {
    return source.replace(/(\bport:\s*)\d+/, `$1${port}`);
  }

  return source.replace(
    /(\n  output: "static",)/,
    `$1\n  server: {\n    port: ${port},\n  },`,
  );
}

export async function nextDevPort(appsDirectory) {
  const used = new Set();

  if (await exists(appsDirectory)) {
    const entries = await readdir(appsDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const configPath = path.join(
        appsDirectory,
        entry.name,
        "astro.config.mjs",
      );
      if (!(await exists(configPath))) continue;
      const source = await readFile(configPath, "utf8");
      const match = source.match(/\bport:\s*(\d+)/);
      if (match) used.add(Number(match[1]));
    }
  }

  let port = FIRST_DEV_PORT;
  while (used.has(port)) port += 1;
  return port;
}

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(target)));
    else if (entry.isFile()) files.push(target);
  }

  return files;
}

export async function createSite({ name, title, url, rootDirectory }) {
  const input = validateSiteInput({ name, title, url });
  const templateDirectory = path.join(
    rootDirectory,
    "templates",
    TEMPLATE_NAME,
  );
  const appsDirectory = path.join(rootDirectory, "apps");
  const destination = path.join(appsDirectory, input.name);

  if (!(await exists(templateDirectory))) {
    throw new Error(`Template not found: ${templateDirectory}`);
  }
  if (await exists(destination)) {
    throw new Error(`Site already exists: apps/${input.name}`);
  }

  await mkdir(appsDirectory, { recursive: true });
  const stagingDirectory = await mkdtemp(
    path.join(appsDirectory, `.site-${input.name}-`),
  );

  try {
    await cp(templateDirectory, stagingDirectory, {
      recursive: true,
      filter(source) {
        const relativePath = path.relative(templateDirectory, source);
        const [topLevelDirectory] = relativePath.split(path.sep);
        return !IGNORED_TEMPLATE_DIRECTORIES.has(topLevelDirectory);
      },
    });

    for (const file of await listFiles(stagingDirectory)) {
      const source = await readFile(file, "utf8");
      const output = source
        .replaceAll(TEMPLATE_URL, input.url)
        .replaceAll(TEMPLATE_TITLE, input.title)
        .replaceAll(TEMPLATE_NAME, input.name);
      await writeFile(file, output);
    }

    const configPath = path.join(stagingDirectory, "astro.config.mjs");
    if (await exists(configPath)) {
      const port = await nextDevPort(appsDirectory);
      const source = await readFile(configPath, "utf8");
      await writeFile(configPath, assignDevPort(source, port));
    }

    await rename(stagingDirectory, destination);
  } catch (error) {
    await rm(stagingDirectory, { recursive: true, force: true });
    throw error;
  }

  return destination;
}

async function main() {
  const input = parseArguments(process.argv.slice(2));
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const rootDirectory = path.resolve(scriptDirectory, "..");
  const destination = await createSite({ ...input, rootDirectory });
  process.stdout.write(
    `Created ${path.relative(rootDirectory, destination)}\n`,
  );
  process.stdout.write(
    `Next: pnpm install && pnpm --filter ${input.name} dev\n`,
  );
}

const isCLI =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCLI) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
