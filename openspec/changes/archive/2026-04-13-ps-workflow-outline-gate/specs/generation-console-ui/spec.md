## MODIFIED Requirements

### Requirement: Console workspace layout
The Phase 1 generation page SHALL present a workbench-style layout with a persistent status summary, a control panel for task inputs, and a dedicated task workspace — extended to support a two-phase workflow with an outline confirmation step between outline generation and draft generation.

#### Scenario: Initial page render
- **WHEN** the user opens the generation page
- **THEN** the page MUST show a visible status summary area, an input control panel, and a task workspace without requiring navigation to another page

#### Scenario: Narrow viewport layout
- **WHEN** the page is rendered on a narrow viewport
- **THEN** the interface MUST preserve the same functional areas in a vertical order that prioritizes status summary before task workspace content

### Requirement: Outline confirmation step
The interface SHALL present an editable outline panel after outline generation completes, blocking draft generation until the user confirms the outline.

#### Scenario: Outline generation completes
- **WHEN** the outline pipeline task reaches done status
- **THEN** the interface MUST display the outline_candidate in an editable form and present a confirm action, while keeping the draft generation action disabled

#### Scenario: User edits outline fields
- **WHEN** the user modifies any outline field (thesis, section claim, evidence refs, controls)
- **THEN** the interface MUST call PATCH /api/sessions/{id}/outline to persist the edit before the confirm action is triggered

#### Scenario: User confirms outline
- **WHEN** the user triggers the confirm action after selecting a target language
- **THEN** the interface MUST call POST /api/sessions/{id}/outline/confirm and, on success, enable the draft generation action

#### Scenario: User attempts draft without confirming outline
- **WHEN** the user attempts to trigger draft generation before outline is confirmed
- **THEN** the interface MUST prevent the action and indicate that outline confirmation is required
