#!/usr/bin/env node

import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  TEMPLATE_NAME,
  exists,
  findApp,
  formatAppTable,
  formatWorkersBuilds,
  listDevApps,
  runPnpm,
} from "./lib/apps.mjs";

function usage() {
  return `Usage:
  pnpm site:list
  pnpm site:cf [<name>]
  pnpm site:check [<name>]
  pnpm preview [<name>]
  pnpm deploy [<name>]
  pnpm site:rm <name> [--no-install]`;
}

export async function removeSite({ name, rootDirectory }) {
  if (!name) {
    throw new Error(`Site name required.\n${usage()}`);
  }
  if (name === TEMPLATE_NAME) {
    throw new Error("Refusing to remove the site-starter template.");
  }
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name)) {
    throw new Error("Site name must be kebab-case and begin with a letter.");
  }

  const destination = path.join(rootDirectory, "apps", name);
  if (!(await exists(destination))) {
    throw new Error(`No site at apps/${name}`);
  }

  await rm(destination, { recursive: true, force: true });
  return destination;
}

async function main() {
  const [command, ...argv] = process.argv.slice(2);
  const rootDirectory = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );

  if (!command || command === "list") {
    const apps = await listDevApps(rootDirectory);
    process.stdout.write(
      apps.length === 0
        ? "No sites in apps/.\n"
        : `\nSites\n-----\n${formatAppTable(apps, { worker: true })}`,
    );
    return;
  }

  if (command === "rm") {
    const flags = argv.filter((arg) => arg.startsWith("-"));
    const name = argv.find((arg) => !arg.startsWith("-"));
    if (flags.some((flag) => flag !== "--no-install")) {
      throw new Error(`Unknown option.\n${usage()}`);
    }
    const destination = await removeSite({ name, rootDirectory });
    process.stdout.write(
      `Removed ${path.relative(rootDirectory, destination)}\n`,
    );
    if (!flags.includes("--no-install")) {
      await runPnpm(["install"], { cwd: rootDirectory });
    }
    return;
  }

  if (command === "cf") {
    const app = await findApp(rootDirectory, argv[0]);
    process.stdout.write(`\n${formatWorkersBuilds(app)}`);
    return;
  }

  const script =
    command === "check"
      ? "check"
      : command === "preview"
        ? "preview"
        : command === "deploy"
          ? "deploy"
          : undefined;
  if (!script) throw new Error(usage());

  const app = await findApp(rootDirectory, argv[0]);
  await runPnpm(["--filter", app.name, "run", script], {
    cwd: rootDirectory,
  });
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
