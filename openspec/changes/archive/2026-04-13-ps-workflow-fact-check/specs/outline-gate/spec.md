## MODIFIED Requirements

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
