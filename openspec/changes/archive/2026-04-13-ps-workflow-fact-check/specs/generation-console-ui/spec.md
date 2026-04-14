## MODIFIED Requirements

### Requirement: Pipeline stage monitor
The task workspace SHALL expose all generation stages as a pipeline monitor, extended to include fact_check and repair stages.

#### Scenario: Before generation starts
- **WHEN** no task has been started yet
- **THEN** the pipeline monitor MUST display all supported stages in idle state, including extraction, outline_draft, draft, rewrite, fact_check, and repair

#### Scenario: Active stage is streaming
- **WHEN** chunk or status events indicate a specific stage is currently running
- **THEN** the pipeline monitor MUST visually distinguish that stage from completed and not-yet-started stages

#### Scenario: Stage completes
- **WHEN** a stage completes and the next stage begins
- **THEN** the pipeline monitor MUST retain the completed state for the prior stage and update the new active stage

### Requirement: Fact check report panel
The interface SHALL display the fact_check_report after fact_check stage completes, showing issues and providing a repair action if the check failed.

#### Scenario: Fact check passes
- **WHEN** the fact_check stage completes with pass=true
- **THEN** the interface MUST display a pass indicator and present a "mark as done" action

#### Scenario: Fact check fails
- **WHEN** the fact_check stage completes with pass=false
- **THEN** the interface MUST display the issues list (type, severity, evidence, suggested_fix) and present a repair action

#### Scenario: User triggers repair
- **WHEN** the user triggers the repair action
- **THEN** the interface MUST call POST /api/generate/repair and display the repair stage output in the pipeline monitor
