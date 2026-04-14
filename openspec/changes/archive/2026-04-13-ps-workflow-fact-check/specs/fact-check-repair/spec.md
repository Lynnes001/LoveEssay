## ADDED Requirements

### Requirement: Fact check stage execution
The system SHALL execute a fact_check stage after the rewrite stage completes, producing a structured fact_check_report stored in the fact_check_reports table.

#### Scenario: Fact check passes
- **WHEN** `POST /api/generate/fact-check` is called for a session with workflow_status `draft_completed`
- **THEN** the system MUST stream fact_check stage output, save a fact_check_report with pass=true, and set sessions.workflow_status to `fact_check_passed`

#### Scenario: Fact check fails
- **WHEN** the fact_check stage produces a report with pass=false
- **THEN** the system MUST save the fact_check_report with the issues list, set sessions.workflow_status to `needs_repair`, and NOT advance to done

#### Scenario: Fact check called without draft completed
- **WHEN** `POST /api/generate/fact-check` is called for a session whose workflow_status is not `draft_completed`
- **THEN** the system MUST return 400

### Requirement: Repair stage execution
The system SHALL execute a repair stage when fact_check has failed, using the fact_check_report to guide targeted fixes.

#### Scenario: Repair succeeds and re-check passes
- **WHEN** `POST /api/generate/repair` is called for a session with workflow_status `needs_repair`
- **THEN** the system MUST stream repair stage output, automatically trigger a second fact_check, and if the second fact_check passes set sessions.workflow_status to `fact_check_passed`

#### Scenario: Repair attempt limit reached
- **WHEN** repair has been attempted 2 times and fact_check still fails
- **THEN** the system MUST set sessions.workflow_status to `needs_repair_manual` and NOT trigger further automatic repair

#### Scenario: Repair called without needs_repair status
- **WHEN** `POST /api/generate/repair` is called for a session whose workflow_status is not `needs_repair`
- **THEN** the system MUST return 400

### Requirement: Fact check report read
The system SHALL provide an API to read the latest fact_check_report for a session.

#### Scenario: Read fact check report
- **WHEN** `GET /api/sessions/{id}/fact-check-report` is called and a report exists
- **THEN** the system MUST return the latest fact_check_report including pass, issues list, and repair_attempt count

#### Scenario: No report exists
- **WHEN** `GET /api/sessions/{id}/fact-check-report` is called and no report exists
- **THEN** the system MUST return 404

### Requirement: Skip fact check to done
The system SHALL allow the user to mark a session as done without going through fact_check, when workflow_status is `draft_completed`.

#### Scenario: Skip to done
- **WHEN** `POST /api/sessions/{id}/complete` is called for a session with workflow_status `draft_completed`
- **THEN** the system MUST set sessions.workflow_status to `done`
