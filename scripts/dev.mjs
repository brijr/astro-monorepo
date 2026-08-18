#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  formatDevBanner,
  listDevApps,
  openBrowser,
  stopAstro,
} from "./lib/apps.mjs";

function writePrefixed(name, width, chunk, stream) {
  const text = chunk.toString();
  for (const line of text.split(/\r?\n/)) {
    if (line.length > 0) stream.write(`${name.padEnd(width)}  ${line}\n`);
  }
}

async function main() {
  const rootDirectory = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const apps = await listDevApps(rootDirectory);

  if (apps.length === 0) {
    process.stderr.write("No Astro apps found under apps/.\n");
    process.exitCode = 1;
    return;
  }

  await Promise.all(apps.map((app) => stopAstro(app)));
  process.stdout.write(formatDevBanner(apps));

  const width = Math.max(...apps.map((app) => app.name.length));
  const children = [];
  const shouldOpen = process.env.DEV_NO_OPEN !== "1";

  for (const app of apps) {
    const child = spawn(
      "pnpm",
      ["exec", "astro", "dev", "--port", String(app.port)],
      {
        cwd: app.directory,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let opened = false;
    const onReady = (chunk) => {
      if (opened || !shouldOpen) return;
      if (
        /https?:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+/.test(chunk.toString())
      ) {
        opened = true;
        openBrowser(app.url);
      }
    };

    child.stdout.on("data", (chunk) => {
      writePrefixed(app.name, width, chunk, process.stdout);
      onReady(chunk);
    });
    child.stderr.on("data", (chunk) => {
      writePrefixed(app.name, width, chunk, process.stderr);
      onReady(chunk);
    });
    child.on("exit", (code, signal) => {
      if (signal) return;
      if (code && code !== 0) process.exitCode = code;
    });
    children.push(child);
  }

  const stop = () => {
    for (const child of children) {
      if (!child.killed) child.kill("SIGTERM");
    }
  };

  process.on("SIGINT", () => {
    stop();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    stop();
    process.exit(143);
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
