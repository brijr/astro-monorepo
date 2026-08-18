# Astro Cloudflare Monorepo

A starter for building and independently deploying multiple static Astro sites
from one pnpm workspace. Every site is its own Cloudflare Worker; shared
packages provide a quality floor without forcing the sites to look alike.

Use the GitHub **Use this template** button, or clone the repository and add
sites with `pnpm site:new`.

## What is included

- One demo site under `apps/site`
- A tested `site:new` generator backed by a neutral, buildable template
- Shared Astro layout, container, prose, and semantic CSS tokens in `@repo/ui`
- Shared strict Astro TypeScript and Prettier configuration in `@repo/config`
- Tailwind CSS v4 in every site
- Open Graph, Twitter, canonical, robots, and sitemap metadata in the shared layout
- Cloudflare Workers Static Assets configuration per site
- CI for formatting, generator tests, Astro checks, and production builds

The sites are fully prerendered. They do not install `@astrojs/cloudflare` or
run application code at request time.

## Requirements

- Node.js 22
- pnpm 11.5.2
- A Cloudflare account when you are ready to deploy

## Start locally

```bash
pnpm install
pnpm dev
```

That stops leftover Astro servers on those ports, starts every app under
`apps/`, prints each local URL, and opens those URLs in your default browser.
The demo is `http://localhost:4321`. Set `DEV_NO_OPEN=1` to skip the browser.
A single site, also opened in the browser, is:

```bash
pnpm --filter site dev
```

Run the complete repository gate with:

```bash
pnpm verify
```

## Add a site

```bash
pnpm site:new field-notes \
  --url https://field-notes.example \
  --title "Field Notes"
```

That copies the template, assigns the next local port, runs `pnpm install`, and
prints the local URL plus the Workers Builds settings. Omit the flags to be
prompted. `--dev` starts the new site afterward. `--no-install` skips the
workspace install.

The name must be kebab-case and the URL must be an HTTPS origin without a
path, query, or hash. `--title` is optional and defaults to a title-cased form
of the name. The command validates all input before it writes and refuses to
overwrite an existing app.

After generation:

1. Replace the starter page in `apps/<name>/src/pages/index.astro`.
2. Set the site's visual identity in `apps/<name>/src/styles/theme.css` and
   `THEME_COLOR` in `apps/<name>/src/lib/constants.ts`.
3. Run `pnpm site:check <name>` and `pnpm --filter <name> build`.
4. Connect the Worker with [the printed Workers Builds settings](docs/workers-builds.md).

## Repository structure

```text
apps/
  site/                independently deployable Astro site
packages/
  config/              shared TypeScript and formatting config
  ui/                  neutral Astro and CSS primitives
templates/
  site-starter/        validated source for site:new
scripts/
  create-site.mjs      site:new generator
  dev.mjs              pnpm dev
  site.mjs             list, remove, preview, deploy, check, CF recipe
```

See [the architecture notes](docs/architecture.md) for the ownership boundary
between apps and shared packages.

## Commands

| Command                            | Purpose                                     |
| ---------------------------------- | ------------------------------------------- |
| `pnpm site:new <name> --url <url>` | Generate a site, install, print CF settings |
| `pnpm site:list`                   | List apps, local URLs, and Worker names     |
| `pnpm site:cf [<name>]`            | Print Workers Builds settings               |
| `pnpm site:rm <name>`              | Remove an app                               |
| `pnpm site:check [<name>]`         | `astro check` one site                      |
| `pnpm dev`                         | Run every app, print URLs, open the browser |
| `pnpm preview [<name>]`            | Build and preview through Wrangler          |
| `pnpm deploy [<name>]`             | Build and deploy one Worker                 |
| `pnpm --filter <name> dev`         | Run one site locally                        |
| `pnpm check`                       | Run `astro check` in every app and template |
| `pnpm build`                       | Build every app and template                |
| `pnpm test`                        | Test the generator and site CLI             |
| `pnpm verify`                      | Run the complete repository gate            |

## Adding server behavior later

This starter intentionally targets static sites. If a site needs API routes,
runtime rendering, or Cloudflare bindings, treat that as an app-level migration:
install and configure `@astrojs/cloudflare`, update its Wrangler entry point and
assets binding, and keep the other sites static.

## License

MIT. See [LICENSE](LICENSE).
