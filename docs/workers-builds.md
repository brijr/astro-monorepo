# Cloudflare Workers Builds

Create one Cloudflare Worker for every app. Connect each Worker to the same Git
repository, then give it an app-specific root directory and build watch paths.

## Per-site settings

For a site named `field-notes`, use:

| Setting                       | Value                                |
| ----------------------------- | ------------------------------------ |
| Worker name                   | `field-notes`                        |
| Production branch             | `main`                               |
| Root directory                | `apps/field-notes`                   |
| Build command                 | `pnpm run build`                     |
| Deploy command                | `pnpm exec wrangler deploy`          |
| Non-production deploy command | `pnpm exec wrangler versions upload` |
| Build variable                | `PNPM_VERSION=11.5.2`                |

The Worker name must match `name` in the app's `wrangler.jsonc`. The app-level
`.node-version` pins Node 22 because Cloudflare evaluates version files from the
configured root directory.

Configure these repository-relative build watch include paths:

```text
apps/field-notes/*
packages/*
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
```

This rebuilds the Worker for its own changes, shared-package changes, or a
workspace dependency change. Changes confined to a different app do not rebuild
it. Repeat the setup for each generated site with its own app path and Worker
name.

## First deployment

1. Push the repository to GitHub or GitLab.
2. In Cloudflare Workers & Pages, create or select the Worker named after the app.
3. Connect the repository and enter the settings above.
4. Trigger the first build and verify the exact `*.workers.dev` URL.
5. Add a custom domain in the Worker dashboard only after the generated URL is
   serving the intended build.
6. Verify both the custom domain and `workers.dev` URL after certificate and DNS
   provisioning complete.

Custom domains are not declared by the starter. This keeps cloning or generating
a site from claiming a domain during its first automated deployment.

## Local deployment commands

Authenticate Wrangler first:

```bash
pnpm exec wrangler login
```

If this login has several Cloudflare accounts, set the account before deploy:

```bash
export CLOUDFLARE_ACCOUNT_ID=...
pnpm deploy field-notes
```

`pnpm site:cf field-notes` prints the dashboard settings for that app. A dry-run
validates the build and Wrangler configuration without uploading a new Worker
version:

```bash
pnpm --filter field-notes deploy:dry-run
```

A real deployment changes Cloudflare state; run it only for the intended
account and Worker.
