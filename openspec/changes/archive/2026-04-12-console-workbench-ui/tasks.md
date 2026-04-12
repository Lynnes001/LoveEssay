## 1. Restructure the page shell

- [x] 1.1 Rework `frontend/index.html` into a workbench layout with a top status summary, a left control panel, and a right task workspace
- [x] 1.2 Preserve the existing form field names and output node ids while introducing structural containers needed for the new layout
- [x] 1.3 Add stage monitor controls or selectors that let the user switch between `extraction`, `draft`, and `rewrite` views

## 2. Apply the console visual system

- [x] 2.1 Replace the current decorative background, elevated card treatment, and large rounded styling in `frontend/css/base.css` with a restrained workbench visual system
- [x] 2.2 Define clear visual states for idle, pending, running, done, and failed task or stage status
- [x] 2.3 Add responsive layout rules so narrow viewports preserve status summary, task workspace, and control panel in a usable order

## 3. Wire focused stage behavior

- [x] 3.1 Update `frontend/js/generation-form.js` to maintain lightweight UI state for the active stage and the user-selected stage view
- [x] 3.2 Make stream and completion events automatically focus the active stage during generation and the `rewrite` stage after successful completion
- [x] 3.3 Ensure task creation failures and stream errors update the persistent status summary without clearing previously received output

## 4. Verify the redesigned workflow

- [x] 4.1 Update or add front-end tests for stage focus behavior and status summary updates
- [x] 4.2 Manually verify the full submission and streaming workflow in the browser for idle, running, done, and failed states
