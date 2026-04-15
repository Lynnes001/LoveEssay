## ADDED Requirements

### Requirement: Outline draft generation
The system SHALL execute an outline_draft stage after extraction, producing an outline_candidate stored in the outlines table with status `candidate`.

#### Scenario: Outline generation succeeds
- **WHEN** a valid `POST /api/generate/outline` request is submitted with session_id and student inputs
- **THEN** the system MUST stream extraction stage output followed by outline_draft stage output, save the resulting outline_candidate to the outlines table, and return a task_id

#### Scenario: Outline JSON parsing fails
- **WHEN** the outline_draft stage produces output that cannot be parsed as valid outline JSON
- **THEN** the system MUST set the task status to `failed`, store the error message, and NOT advance the session workflow_status

### Requirement: Outline read and edit
The system SHALL provide an API and UI for reading and editing the current outline_candidate for a session. The frontend MUST resolve `evidence_refs` IDs against the session profile and display the corresponding experience/achievement title and detail inline within each section, so users can review which source material is being referenced without consulting the raw profile separately.

#### Scenario: Read current outline
- **WHEN** `GET /api/sessions/{id}/outline` is called and an outline exists for the session
- **THEN** the system MUST return the full outline object including schema_version, status, updated_at, and data fields

#### Scenario: Edit outline fields
- **WHEN** `PATCH /api/sessions/{id}/outline` is called with partial data updates
- **THEN** the system MUST update the outline data, set updated_at to the current timestamp, and return the updated outline with status remaining `candidate`

#### Scenario: Outline not yet generated
- **WHEN** `GET /api/sessions/{id}/outline` is called and no outline exists for the session
- **THEN** the system MUST return 404

#### Scenario: Evidence refs resolved in frontend
- **WHEN** the outline panel renders a section with `evidence_refs`
- **THEN** the frontend MUST display each referenced experience or achievement's title and detail inline, not just the ID string

#### Scenario: Evidence refs resolve fails gracefully
- **WHEN** a `evidence_refs` ID cannot be found in the session profile (e.g., profile not yet available)
- **THEN** the frontend MUST fall back to displaying the raw ID string without error

### Requirement: Outline confirmation gate
The system SHALL require explicit user confirmation of the outline before draft generation is permitted. The sessions.workflow_status state machine is extended to include fact_check and repair states.

#### Scenario: Confirm outline
- **WHEN** `POST /api/sessions/{id}/outline/confirm` is called with a valid outline_confirmed payload including target_language
- **THEN** the system MUST set the outline status to `confirmed`, set sessions.workflow_status to `outline_confirmed`, and return the confirmed outline

#### Scenario: Confirm outline missing target_language
- **WHEN** `POST /api/sessions/{id}/outline/confirm` is called without target_language
- **THEN** the system MUST return 422 and NOT change the outline status

#### Scenario: Draft generation blocked without confirmed outline
- **WHEN** `POST /api/generate/draft` is called for a session whose workflow_status is not `outline_confirmed`
- **THEN** the system MUST return 400 with an error indicating outline confirmation is required

#### Scenario: Session workflow status valid values
- **WHEN** any API sets sessions.workflow_status
- **THEN** the value MUST be one of: `pending`, `outline_drafted`, `outline_confirmed`, `draft_completed`, `fact_check_passed`, `needs_repair`, `needs_repair_manual`, `done`

### Requirement: Draft pipeline using confirmed outline
The system SHALL execute draft and rewrite stages using the confirmed outline as the structural boundary.

#### Scenario: Draft generation succeeds
- **WHEN** `POST /api/generate/draft` is called for a session with workflow_status `outline_confirmed`
- **THEN** the system MUST stream draft stage output followed by rewrite stage output, using outline_confirmed data as input to the draft prompt

#### Scenario: Session workflow status advances after draft completes
- **WHEN** the draft pipeline completes successfully
- **THEN** the system MUST set sessions.workflow_status to `draft_completed`

### Requirement: Outline draft uses selective evidence
The outline_draft prompt SHALL instruct the AI to select evidence based on what best supports each claim, and explicitly state that not all experiences or achievements need to be referenced.

#### Scenario: Prompt allows partial evidence selection
- **WHEN** the outline_draft prompt is rendered
- **THEN** it MUST include a rule stating that evidence selection should prioritize narrative coherence over coverage of all available materials
