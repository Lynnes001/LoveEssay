## ADDED Requirements

### Requirement: Session list view
The interface SHALL display a list of all sessions, allowing the user to navigate to any session and create new sessions.

#### Scenario: View session list
- **WHEN** the user opens the session list page
- **THEN** the page MUST display all sessions with their name, workflow_status, and created_at, ordered by most recently updated

#### Scenario: Create new session
- **WHEN** the user triggers the create session action
- **THEN** the interface MUST prompt for a session name and optionally a student association, then create the session via POST /api/sessions and navigate to the session detail page

#### Scenario: Navigate to session
- **WHEN** the user selects a session from the list
- **THEN** the interface MUST navigate to the session detail page for that session

### Requirement: Session rename
The system SHALL allow renaming a session at any point in its lifecycle.

#### Scenario: Rename session via API
- **WHEN** `PATCH /api/sessions/{id}` is called with a new name
- **THEN** the system MUST update the session name and return the updated session

#### Scenario: Rename session via UI
- **WHEN** the user edits the session name in the session detail page
- **THEN** the interface MUST call PATCH /api/sessions/{id} and display the updated name

### Requirement: Session CRUD API
The system SHALL provide a complete CRUD API for sessions.

#### Scenario: List sessions
- **WHEN** `GET /api/sessions` is called
- **THEN** the system MUST return up to 50 most recently updated sessions with id, name, workflow_status, student_id, created_at

#### Scenario: Create session
- **WHEN** `POST /api/sessions` is called with a name and optional student_id
- **THEN** the system MUST create the session with workflow_status `pending` and return the created session

#### Scenario: Get single session
- **WHEN** `GET /api/sessions/{id}` is called
- **THEN** the system MUST return the session with all fields including workflow_status and student association

#### Scenario: Delete session
- **WHEN** `DELETE /api/sessions/{id}` is called
- **THEN** the system MUST delete the session and all associated outlines, documents, tasks, and reports via cascade
