## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Outline draft uses selective evidence
The outline_draft prompt SHALL instruct the AI to select evidence based on what best supports each claim, and explicitly state that not all experiences or achievements need to be referenced.

#### Scenario: Prompt allows partial evidence selection
- **WHEN** the outline_draft prompt is rendered
- **THEN** it MUST include a rule stating that evidence selection should prioritize narrative coherence over coverage of all available materials
