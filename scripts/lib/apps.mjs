import { spawn } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

export const FIRST_DEV_PORT = 4321;
export const TEMPLATE_NAME = "site-starter";

export async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

export function parsePort(source) {
  const match = source.match(/\bport:\s*(\d+)/);
  return match ? Number(match[1]) : undefined;
}

export function parseWorkerName(source) {
  const match = source.match(/"name"\s*:\s*"([^"]+)"/);
  return match?.[1];
}

export async function listDevApps(rootDirectory) {
  const appsDirectory = path.join(rootDirectory, "apps");
  const apps = [];

  if (!(await exists(appsDirectory))) return apps;

  const entries = await readdir(appsDirectory, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

    const directory = path.join(appsDirectory, entry.name);
    const packagePath = path.join(directory, "package.json");
    const configPath = path.join(directory, "astro.config.mjs");
    if (!(await exists(packagePath)) || !(await exists(configPath))) continue;

    const pkg = JSON.parse(await readFile(packagePath, "utf8"));
    const config = await readFile(configPath, "utf8");
    const port = parsePort(config) ?? FIRST_DEV_PORT;
    const wranglerPath = path.join(directory, "wrangler.jsonc");
    const worker = (await exists(wranglerPath))
      ? parseWorkerName(await readFile(wranglerPath, "utf8"))
      : undefined;

    apps.push({
      directory,
      folder: entry.name,
      name: pkg.name ?? entry.name,
      port,
      url: `http://localhost:${port}`,
      worker: worker ?? pkg.name ?? entry.name,
    });
  }

  return apps.sort(
    (left, right) =>
      left.port - right.port || left.name.localeCompare(right.name),
  );
}

export async function findApp(rootDirectory, name) {
  const apps = await listDevApps(rootDirectory);
  if (!name) {
    if (apps.length === 1) return apps[0];
    throw new Error(
      apps.length === 0
        ? "No Astro apps found under apps/."
        : `Specify a site:\n${formatAppTable(apps)}`,
    );
  }

  const app = apps.find((item) => item.folder === name || item.name === name);
  if (!app) {
    throw new Error(`Unknown site: ${name}\n${formatAppTable(apps)}`);
  }
  return app;
}

export async function nextDevPort(rootDirectory) {
  const used = new Set(
    (await listDevApps(rootDirectory)).map((app) => app.port),
  );
  let port = FIRST_DEV_PORT;
  while (used.has(port)) port += 1;
  return port;
}

export function formatAppTable(apps, { worker = false } = {}) {
  if (apps.length === 0) return "No sites in apps/.\n";

  const nameWidth = Math.max(...apps.map((app) => app.name.length), 4);
  const lines = [];
  for (const app of apps) {
    const columns = [app.name.padEnd(nameWidth), app.url];
    if (worker) columns.push(app.worker);
    lines.push(columns.join("  "));
  }
  return `${lines.join("\n")}\n`;
}

export function formatDevBanner(apps) {
  return `\nDev servers\n-----------\n${formatAppTable(apps)}`;
}

export function formatWorkersBuilds(app) {
  return `Workers Builds
--------------
Worker name                    ${app.worker}
Production branch              main
Root directory                 apps/${app.folder}
Build command                  pnpm run build
Deploy command                 pnpm exec wrangler deploy
Non-production deploy command  pnpm exec wrangler versions upload
Build variable                 PNPM_VERSION=11.5.2

Watch include paths
apps/${app.folder}/*
packages/*
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
`;
}

export function openBrowser(url) {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  spawn(command, args, { detached: true, stdio: "ignore" }).unref();
}

export function stopAstro(app) {
  return new Promise((resolve) => {
    const child = spawn("pnpm", ["exec", "astro", "dev", "stop"], {
      cwd: app.directory,
      stdio: "ignore",
    });
    const finish = () => resolve();
    child.on("exit", finish);
    child.on("error", finish);
  });
}

export function runPnpm(args, { cwd, stdio = "inherit" } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", args, { cwd, stdio, env: process.env });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`pnpm ${args.join(" ")} exited with ${signal}`));
        return;
      }
      if (code && code !== 0) {
        reject(new Error(`pnpm ${args.join(" ")} exited with ${code}`));
        return;
      }
      resolve();
    });
  });
}
