# Repository guide

This is a pnpm monorepo of independent static Astro sites deployed as
Cloudflare Workers with Static Assets.

## Structure

- `apps/*` contains deployable sites. Every app owns its Worker name, canonical
  URL, content, and theme.
- `packages/ui` contains neutral Astro layout and typography primitives.
- `packages/config` contains shared TypeScript and Prettier configuration.
- `templates/site-starter` is the validated source copied by `pnpm site:new`.

## Commands

- Use `pnpm site:new <name> --url <https-url> [--title <title>]` to add a site.
  Omit flags to be prompted. Use `--dev` to start the new site.
- Use `pnpm site:list`, `pnpm site:cf <name>`, and `pnpm site:rm <name>` to
  inspect or remove apps. Never delete `templates/site-starter`.
- Use `pnpm dev` to run every app, print each local URL, and open them in the
  default browser. It stops leftover Astro servers on those ports first.
  `DEV_NO_OPEN=1` skips the browser. Use `pnpm --filter <name> dev` for one site.
- Use `pnpm preview <name>` and `pnpm deploy <name>` from the repo root. If this
  login has several Cloudflare accounts, set `CLOUDFLARE_ACCOUNT_ID`.
- Run `pnpm verify` before handing off changes.
- Use `astro check`, not raw `tsc`, as the Astro type/template gate.

## Boundaries

- Keep sites static unless a task explicitly introduces runtime rendering or
  API routes. That change requires evaluating `@astrojs/cloudflare`.
- Shared UI must remain visually neutral. Put palette, font, radius, and accent
  choices in each app's `src/styles/theme.css`.
- Do not put secrets in `wrangler.jsonc`. Use `.dev.vars` locally and Workers
  secrets or build variables in Cloudflare.
- A successful push or build is not proof of deployment. Verify the exact
  Worker URL and custom domain separately.
