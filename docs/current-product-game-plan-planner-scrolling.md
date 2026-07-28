# Planner scrolling and board viewport decision

Last updated: 28 July 2026
Status: launch-critical UX requirement

## Confirmed benchmark

Microsoft Teams / Planner is the minimum usability benchmark for the CG Dynamics Planner board.

## Required board behaviour

- The Planner should operate inside one focused board viewport rather than forcing the whole page to grow vertically with the tallest bucket.
- Every bucket/column must have its own independent vertical scrolling region.
- Staff should be able to hover over a bucket and use the mouse wheel or trackpad to scroll only that bucket up and down.
- Scrolling one bucket must not move every other bucket or the entire page.
- The bucket heading and primary `Add task` control should remain easy to access while the bucket contents scroll.
- The board should have one clear horizontal scrolling surface for moving between buckets.
- Horizontal navigation should remain in a predictable position and must not require scrolling the whole page to the bottom first.
- Remove duplicate, stacked or competing horizontal and vertical scrollbars from the Planner page.
- Avoid a page-level scrollbar being used as the primary way to navigate long bucket contents.
- Long buckets must not create large empty areas beneath shorter buckets.
- The board should remain focused in one place, similar to Teams, so horizontal bucket movement and per-bucket vertical movement feel natural.

## Desktop interaction

- Mouse wheel/trackpad over a bucket scrolls that bucket vertically.
- Shift-wheel or the main board scrollbar moves horizontally where appropriate.
- The board must not unexpectedly hijack normal page scrolling outside the board area.
- Scrollbars may be visually subtle but must remain discoverable and accessible.

## Mobile and touch interaction

- Each bucket should remain independently scrollable by touch.
- Horizontal swiping moves between buckets without causing accidental page-level navigation.
- The layout must avoid nested-scroll traps and preserve access to task creation and task detail actions.

## Acceptance expectations

1. Open a board with several buckets of very different lengths.
2. Scroll a long bucket vertically without moving adjacent buckets or the whole page.
3. Horizontally move between buckets using one clear board-level mechanism.
4. Confirm there is no duplicate horizontal scrollbar at both the top and bottom of unrelated page containers.
5. Confirm the `Add task` control remains immediately accessible near each bucket heading.
6. Confirm short buckets do not create excessive empty vertical space because another bucket is long.
7. Test desktop mouse, trackpad and mobile touch behaviour.

## Delivery rule

This requirement is recorded for the next Planner/staff-management mission. Do not issue a second coding-agent prompt while the current Microsoft recovery mission is still active.
