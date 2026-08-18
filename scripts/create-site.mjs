#!/usr/bin/env node

import { createInterface } from "node:readline/promises";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  TEMPLATE_NAME,
  exists,
  findApp,
  formatWorkersBuilds,
  nextDevPort,
  runPnpm,
} from "./lib/apps.mjs";

const TEMPLATE_TITLE = "Site Starter";
const TEMPLATE_URL = "https://site-starter.example.com";
const IGNORED_TEMPLATE_DIRECTORIES = new Set([
  ".astro",
  ".wrangler",
  "dist",
  "node_modules",
]);

export function usage() {
  return "Usage: pnpm site:new [<kebab-case-name> --url <https-url>] [--title <title>] [--dev] [--no-install]";
}

export function parseArguments(argv) {
  const values = {
    name: undefined,
    title: undefined,
    url: undefined,
    dev: false,
    install: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];

    if (flag === "--dev") {
      values.dev = true;
      continue;
    }
    if (flag === "--no-install") {
      values.install = false;
      continue;
    }
    if ((flag === "--title" || flag === "--url") && argv[index + 1]) {
      values[flag.slice(2)] = argv[index + 1];
      index += 1;
      continue;
    }
    if (flag.startsWith("-")) {
      throw new Error(`Unknown or incomplete option: ${flag}\n${usage()}`);
    }
    if (values.name) {
      throw new Error(`Unexpected argument: ${flag}\n${usage()}`);
    }
    values.name = flag;
  }

  if (!values.name || !values.url) {
    return { ...values, incomplete: true };
  }

  return {
    ...validateSiteInput(values),
    dev: values.dev,
    install: values.install,
  };
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

async function ask(question) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

export async function completeSiteInput(values) {
  const next = { ...values };
  if (!next.name) next.name = await ask("Site name (kebab-case): ");
  if (!next.url) next.url = await ask("Canonical HTTPS URL: ");
  if (!next.title) {
    const title = await ask("Title (optional): ");
    if (title) next.title = title;
  }
  return {
    ...validateSiteInput(next),
    dev: values.dev,
    install: values.install,
  };
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
      const port = await nextDevPort(rootDirectory);
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

export function formatCreatedSite(app) {
  return `Created apps/${app.folder}
Local  ${app.url}

${formatWorkersBuilds(app)}
Next
pnpm --filter ${app.name} dev
pnpm site:cf ${app.name}
`;
}

async function main() {
  let input = parseArguments(process.argv.slice(2));
  if (input.incomplete) {
    if (!process.stdin.isTTY) throw new Error(usage());
    input = await completeSiteInput(input);
  }

  const rootDirectory = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  await createSite({ ...input, rootDirectory });

  if (input.install) {
    await runPnpm(["install"], { cwd: rootDirectory });
  }

  const app = await findApp(rootDirectory, input.name);
  process.stdout.write(formatCreatedSite(app));

  if (input.dev) {
    await runPnpm(["--filter", app.name, "dev"], { cwd: rootDirectory });
  }
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
