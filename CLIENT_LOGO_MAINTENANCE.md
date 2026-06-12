# Client logo maintenance

A simple, repeatable workflow for adding client logos to CG Dynamics.

## How it works

1. **Drop new logos into `logo-dump/`.**
   Supported formats: `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`.
   Name the file after the client (e.g. `Cape Lumber.png`, `RedOak.png`).
   Originals in `logo-dump/` are **never** modified or deleted.

2. **Run the maintenance script.**

   ```bash
   node scripts/sync-client-logos.mjs
   ```

   Each image is given a clean slug filename and **copied** into
   `public/client-logos/`. The script prints three lists: **Copied**,
   **Skipped**, and **Needs review**.

3. **Logos are served from `public/client-logos/`.**
   The app auto-matches a logo to a client by slugifying the client's name.

4. **Client names auto-match by slug.**
   A client named `Cape Lumber` resolves to `/client-logos/cape-lumber.png`
   (any supported extension). No database change is required.

5. **Leave the client's "logo URL" field blank** unless you want to override
   the local logo with a custom external image. The lookup order is:

   1. `clients.logo_url` (if filled in)
   2. local `public/client-logos/<slug>.<ext>` — tried as `.png`, `.jpg`,
      `.jpeg`, `.webp`, `.svg`
   3. the client's initials as a fallback

6. **Unclear logos are listed under "Needs review."**
   When a filename is messy (several filler words, trailing artifacts, or an
   ambiguous brand name), the script copies it with the safest clean slug and
   flags it so you can confirm or rename it.

## Slug rules

- lowercase
- spaces and underscores become hyphens
- `CamelCase` joins are split (`RedOak` → `red-oak`)
- duplicate hyphens are collapsed
- common filler words are removed: `logo`, `final`, `copy`, `white`, `black`,
  `transparent`, `icon`, `01`, `02`, `new`, `old`, `promotion`, `promotions`
- a trailing single-character token (e.g. `0`, `o`) is treated as an export
  artifact and removed

### Examples

| Source filename                 | Slug                     |
| ------------------------------- | ------------------------ |
| `RedOak.png`                    | `red-oak.png`            |
| `Cape Lumber.png`               | `cape-lumber.png`        |
| `CG Production House.png`       | `cg-production-house.png`|
| `WISEMAN GROUP LOGO.png`        | `wiseman-group.png`      |
| `NOVUS STEEL 0.png`             | `novus-steel.png`        |
| `BRAIZE_PROMOTIONS_01_WHITE.png`| `braize.png`             |
| `Braize Promotions.png`         | `braize.png`             |

Messy filenames (several filler words removed or a trailing artifact stripped)
are still listed under **Needs review** so you can confirm the client name —
even when the slug is correct. The original in `logo-dump/` is always untouched.

## Making a logo match a client

The copied filename slug must equal the slug of the client's **name** in the
app. If a client's logo is not showing:

1. Check the client's exact name in `/admin` (Clients).
2. Confirm `public/client-logos/<name-slug>.<ext>` exists.
3. If the slugs differ (common for messy filenames), rename the copied file to
   match the client-name slug, or fill in the client's "logo URL" field.

Re-running `node scripts/sync-client-logos.mjs` is always safe — it only adds
or overwrites files in `public/client-logos/` and never touches `logo-dump/`.
