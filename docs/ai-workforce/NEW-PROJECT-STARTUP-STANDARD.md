# New Project Startup Standard

Status: CURRENT cross-project startup rule
Applies to: new CG apps, tools, websites and repositories

Purpose: prevent duplicate local folders, mismatched repo/package names, accidental scaffolding into the wrong path, and avoidable cleanup before coding starts.

## Rule 1 — one project, one confirmed local folder

Before running `mkdir`, `create-next-app`, `git init`, `gh repo create`, Vercel setup, Supabase setup or any bootstrap command, confirm the exact local folder that will own the project.

If CA has already created or opened the intended folder in VS Code, use that exact folder. Do not invent another folder, category path or casing variant.

Examples:

- already open: `C:\Projects\cg-pay` → use it;
- do not also create `C:\Projects\CG-Apps\cg-pay`;
- do not create `C:\Projects\CG-Pay` and later work around package-name restrictions by creating a second folder.

If the intended path is unclear, stop before creating anything.

## Rule 2 — technical names are lowercase kebab-case

Repository slug, local folder basename and npm/package name should be lowercase kebab-case from the start unless a specific tool requires otherwise.

Correct:

- product display name: `CG Pay`
- local folder: `cg-pay`
- GitHub repo: `cg-pay`
- npm package: `cg-pay`

Avoid capitals, spaces, underscores and duplicate casing variants in technical names.

Brand/UI naming is separate from filesystem/package naming.

## Rule 3 — inspect before creating

Before creating a folder or repository:

1. inspect the current VS Code workspace path;
2. inspect the target parent folder for an existing same-project folder;
3. inspect GitHub for an existing intended repo;
4. confirm the exact GitHub owner/repo;
5. confirm whether the current folder is empty, scaffolded or already a Git repo.

Never solve uncertainty by creating another folder and deciding later which one is canonical.

## Rule 4 — fix the exact folder, do not work around it

If the confirmed folder name is invalid for the package/tool being used, fix that exact folder first.

For Windows case-only renames, close VS Code or any process locking the directory, then rename via a temporary name if necessary:

```powershell
Rename-Item CG-Pay cg-pay-temp
Rename-Item cg-pay-temp cg-pay
```

Do not create a second project directory as a workaround.

## Rule 5 — scaffold only after path validation

For a Next.js app already opened in its confirmed empty folder:

```powershell
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --use-npm --yes
```

The `.` means scaffold into the current confirmed folder. Do not provide another destination path unless intentionally creating a different project.

Only after the scaffold succeeds should Git/GitHub setup continue.

## Rule 6 — GitHub creation comes from the confirmed local project

Preferred new-repo flow:

```powershell
git branch -M main
gh repo create CGProductionHouse/<repo-slug> --private --source=. --remote=origin --push
```

Before running it, verify the authenticated GitHub account and that the intended repo does not already exist.

## Rule 7 — websites and apps use the same anti-duplicate discipline

Websites normally live under:

`C:\Projects\CG-Websites\<lowercase-slug>`

Apps/tools may use another confirmed canonical path, including a root-level project folder where appropriate. The important rule is not the category folder; it is that the exact path is confirmed once and then reused consistently.

Never silently move a project into `CG-Websites`, `CG-Apps` or another category after CA has already created/opened a different intended folder.

## Fail-closed startup checklist

Do not scaffold until all are true:

- exact local path confirmed;
- folder basename is tool/package-safe and lowercase kebab-case;
- no duplicate sibling/project folder exists;
- exact GitHub owner/repo confirmed;
- repo does not already exist unless intentionally reusing it;
- current folder state is understood;
- no active unrelated coding agent owns the same branch/worktree.

If any item is uncertain, stop before creating files.
