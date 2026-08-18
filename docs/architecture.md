# Architecture

## One app, one deployment

Every directory under `apps/` is an Astro project and a Cloudflare Worker. It
owns its canonical URL, Worker name, pages, public assets, and theme. A change
to one app does not require a release of another app.

## Share foundations, not identity

`@repo/ui` owns the small interfaces that should behave consistently:

- `BaseLayout` — document shell and baseline metadata
- `Container` — shared page-width behavior
- `Prose` — long-form typography structure
- semantic token names and browser defaults

Each app assigns the actual color, font, radius, and width values in
`src/styles/theme.css`. Shared components style against those values. Do not add
brand-specific choices to `@repo/ui`. Dark palettes are an app-level opt-in:
set `color-scheme: light dark` and `light-dark()` values in that theme file.
The shared token sheet stays light-only so generated sites do not advertise a
dark theme they have not defined.

`@repo/config` owns strict Astro TypeScript and formatting policy. App-specific
integrations stay in the app's Astro configuration.

## Static by default

Astro renders every route during the build and Wrangler uploads `dist/` through
Workers Static Assets. There is no request-time JavaScript Worker in the base
template. This keeps deployments small and makes runtime bindings impossible to
add accidentally.

Adopt `@astrojs/cloudflare` only inside an app that has a concrete runtime need.
Do not migrate every site merely to keep their dependency lists identical.

## Generator boundary

`templates/site-starter` is a normal workspace project, so checks and builds
continuously prove that newly generated sites begin valid. `site:new` stages a
copy under `apps/`, replaces the name, title, and canonical URL, then atomically
renames it into place. A failure removes the staging directory.
