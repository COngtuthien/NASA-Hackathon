# Phase 12 rollback: return to the website as it was before the themes

Phase 12 (light and dark themes) was built on its own branch from a preserved baseline. Nothing was merged into
`main`, nothing was force-pushed, and no history was rewritten. Going back is a branch switch; Phase 12 stays
available on its branch.

## The two versions

| | Branch | Commit |
|---|---|---|
| **Baseline** (Phase 11, the dark-only website before Phase 12) | `backup/spacefire-before-phase12` (local and on GitHub) | `e5edd9f3c0e65e2e0f51367a3a06f343c8c0c8ff` |
| Same baseline, original branch (unchanged) | `feature/spacefire-phase11-immersive-3d-ux` | `e5edd9f3c0e65e2e0f51367a3a06f343c8c0c8ff` |
| **Phase 12** (light and dark themes) | `feature/spacefire-phase12-premium-themes` | see `git log -1 feature/spacefire-phase12-premium-themes` |

The baseline was verified before Phase 12 started: it equalled the pushed Phase 11 branch, and that commit had passed the
full suite (Playwright 138 passed / 1 skipped on the production build, pytest 181) in the Phase 11 session.

## Switch to the baseline (old UI)

From `D:\NASA Hackathon`:

```bash
git status                                     # 1. any uncommitted changes? see the next section first
git fetch origin
git switch backup/spacefire-before-phase12     # 2. the pre-Phase-12 website
git log -1 --format=%H                         # 3. must print e5edd9f3c0e65e2e0f51367a3a06f343c8c0c8ff
```

Then rebuild or restart the frontend as usual (`scripts\start.ps1`, or `npm run build` / `npm run dev` in
`frontend`). Data and the backend are the same on both branches.

If the local branch is missing (fresh clone): `git switch -c backup/spacefire-before-phase12 origin/backup/spacefire-before-phase12`.

## If you have uncommitted changes

Do not discard them. Either commit them on the branch you are on:

```bash
git add <files>
git commit -m "WIP: my changes"
```

or put them aside and bring them back later:

```bash
git stash push -u -m "before switching to the baseline"
git switch backup/spacefire-before-phase12
# ... later, back on the branch where you made them:
git switch feature/spacefire-phase12-premium-themes
git stash pop
```

`git switch` refuses to switch when a local change would be overwritten, so nothing is lost silently.

## Go back to Phase 12

```bash
git switch feature/spacefire-phase12-premium-themes
```

## Keep the old UI as the line of development (without deleting Phase 12)

Continue from the baseline on a new branch; Phase 12 keeps its own branch and history:

```bash
git switch -c feature/continue-from-phase11 backup/spacefire-before-phase12
```

Not recommended as a rollback: `git reset --hard`, force checkout or force push. They are not needed, and they can
destroy work.

## Browser settings left by Phase 12

Phase 12 stores the theme choice in `localStorage["spacefire:theme"]`. The baseline ignores this key, so the old UI
looks exactly as before. To clear it anyway, use the browser's site-data settings, or run
`localStorage.removeItem("spacefire:theme")` in the browser console.

## Verification of these instructions (2026-11-13)

Run in this repository after the Phase 12 commits (results recorded in `docs/IMPLEMENTATION_STATUS.md`):

1. `git switch backup/spacefire-before-phase12` → `git rev-parse HEAD` printed `e5edd9f3c0e65e2e0f51367a3a06f343c8c0c8ff`;
   `frontend/lib/theme.ts` did not exist (pre-Phase-12 tree).
2. `git switch feature/spacefire-phase12-premium-themes` → back on the Phase 12 commit; working tree clean apart from
   the untracked `run.txt` that was there before Phase 12.
3. `git ls-remote origin backup/spacefire-before-phase12` → `e5edd9f…` (the baseline is on GitHub).
