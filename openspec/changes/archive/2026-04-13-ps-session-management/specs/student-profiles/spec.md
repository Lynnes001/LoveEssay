## ADDED Requirements

### Requirement: Student profile CRUD
The system SHALL provide an API for creating, reading, updating, and deleting student profiles.

#### Scenario: Create student profile
- **WHEN** `POST /api/students` is called with a name and optional email and profile_json
- **THEN** the system MUST create the student record and return it with the generated id

#### Scenario: List students
- **WHEN** `GET /api/students` is called
- **THEN** the system MUST return all students with id, name, email, and created_at

#### Scenario: Get student profile
- **WHEN** `GET /api/students/{id}` is called
- **THEN** the system MUST return the full student record including profile_json

#### Scenario: Update student profile
- **WHEN** `PATCH /api/students/{id}` is called with updated fields
- **THEN** the system MUST update only the provided fields and return the updated student

### Requirement: Student association with session
The system SHALL allow a session to optionally reference a student profile, and SHALL pre-fill session inputs from the student profile when the association exists.

#### Scenario: Associate student when creating session
- **WHEN** `POST /api/sessions` is called with a valid student_id
- **THEN** the system MUST create the session with the student_id foreign key set

#### Scenario: Pre-fill session inputs from student profile
- **WHEN** the user opens the session detail page for a session associated with a student
- **THEN** the interface MUST pre-populate the student_background input field from the student's profile_json if the field is empty
