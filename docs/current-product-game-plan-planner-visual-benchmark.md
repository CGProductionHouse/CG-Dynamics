# Planner visual benchmark — Microsoft Teams parity

Last updated: 28 July 2026
Status: launch-critical UX requirement

This addendum records the confirmed visual and interaction benchmark for the CG Dynamics Planner while the current OpenCode Microsoft recovery mission remains active. It is a backlog/game-plan decision only and must not trigger a parallel coding-agent prompt.

## Confirmed target

The Planner should behave like a focused board application rather than a long scrolling webpage.

Use the supplied Microsoft Teams / Planner screenshots as the minimum interaction benchmark:

- The board remains inside one focused viewport.
- Columns are compact and consistently sized.
- Each column heading remains visible and easy to scan.
- The primary `Add task` action sits directly below each column heading.
- Each bucket owns its own vertical scroll area.
- Hovering over a bucket and using the mouse wheel scrolls that bucket rather than the full page.
- Trackpad scrolling follows the same local-column behaviour.
- Long columns do not stretch the entire page height.
- Other columns remain stable while one column is scrolled.
- The board uses one clear horizontal scroll path for moving between buckets.
- The page must not expose several competing horizontal or vertical scrollbars.
- The browser/page body should remain visually stable while staff work inside the board.

## Card density and readability

- Cards should be compact enough to scan several tasks without losing important information.
- Task title, checklist preview, due date, status/priority signals and assignee avatars should remain readable.
- Avoid oversized empty spacing that reduces the number of visible tasks.
- Avoid cramped layouts that make cards difficult to select or edit.
- Completed-task groups may collapse within the relevant bucket without disrupting the board.

## Desktop behaviour

- Column headers and `Add task` controls remain reachable without scrolling to the bottom of a long bucket.
- Vertical wheel input over a column scrolls only that column.
- Horizontal navigation is obvious and predictable.
- Opening task details must not reset the board’s horizontal position or every column’s local scroll position.
- Closing task details should return the user to the same board context.

## Mobile and narrow-screen behaviour

- The same mental model must survive on mobile: one focused board, horizontally moving between buckets and vertically scrolling the active bucket.
- Touch gestures must not fight each other or trigger accidental page scrolling.
- Add-task access remains near the top of the current bucket.
- The app shell and Assistant control must not cover essential board controls.

## Acceptance standard

The launch audit should verify that staff can:

1. Open Planner and immediately understand the bucket layout.
2. Add a task at the top of any bucket.
3. Scroll a long bucket without moving the entire webpage.
4. Move horizontally to another bucket using one clear board scroll path.
5. Return to the first bucket without losing local vertical positions unnecessarily.
6. Open and close task details without losing their place.
7. Perform the same core workflow with a mouse, trackpad and touch device.

The goal is not to visually clone Microsoft Teams. The goal is to match or improve its reliable board interaction and remove the current CG Dynamics scroll confusion.
