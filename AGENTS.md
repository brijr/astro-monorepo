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
- Use `pnpm --filter <name> dev` for local development.
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
