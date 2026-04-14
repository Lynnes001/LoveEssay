## ADDED Requirements

### Requirement: Document version list
The interface SHALL display all document versions for a session, allowing the user to view any historical version.

#### Scenario: View version list in session detail
- **WHEN** the user opens a session detail page that has at least one document
- **THEN** the interface MUST display a version list showing version number, stage, word_count, and created_at for each document

#### Scenario: Switch version view
- **WHEN** the user selects a document version from the version list
- **THEN** the interface MUST display the content of that document version in the output area without navigating away

#### Scenario: Latest version default
- **WHEN** the user opens a session detail page
- **THEN** the interface MUST default to displaying the most recent document version

### Requirement: Document version API
The system SHALL provide an API to list and retrieve document versions for a session.

#### Scenario: List session documents
- **WHEN** `GET /api/sessions/{id}/documents` is called
- **THEN** the system MUST return all documents for the session ordered by version descending, including id, version, stage, word_count, and created_at

#### Scenario: Get document content
- **WHEN** `GET /api/documents/{id}` is called
- **THEN** the system MUST return the full document including content

### Requirement: Export document as plain text
The interface SHALL allow the user to copy the content of any document version as plain text.

#### Scenario: Copy to clipboard
- **WHEN** the user triggers the copy action on a displayed document version
- **THEN** the interface MUST copy the document content to the clipboard and show a brief confirmation indicator
