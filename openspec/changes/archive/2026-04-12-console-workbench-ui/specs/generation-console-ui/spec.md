## ADDED Requirements

### Requirement: Console workspace layout
The Phase 1 generation page SHALL present a workbench-style layout with a persistent status summary, a control panel for task inputs, and a dedicated task workspace for pipeline monitoring and output reading.

#### Scenario: Initial page render
- **WHEN** the user opens the Phase 1 generation page
- **THEN** the page MUST show a visible status summary area, an input control panel, and a task workspace without requiring navigation to another page

#### Scenario: Narrow viewport layout
- **WHEN** the page is rendered on a narrow viewport
- **THEN** the interface MUST preserve the same three functional areas in a vertical order that prioritizes status summary before task workspace content

### Requirement: Persistent task status summary
The interface SHALL display the current task metadata in a consistent location, including overall task status and the current pipeline stage whenever that information is available.

#### Scenario: Task submitted successfully
- **WHEN** a generation task is created successfully
- **THEN** the status summary MUST display the created task identifier, session identifier, and a pending or running status without requiring the user to inspect the output area

#### Scenario: Stream status update received
- **WHEN** a stream status event reports a new stage or task state
- **THEN** the status summary MUST update the visible status text in place while preserving the latest known task metadata

#### Scenario: Task fails
- **WHEN** task creation fails or the stream emits a task error
- **THEN** the status summary MUST present the failed state in the same summary area and include the latest available error message

### Requirement: Pipeline stage monitor
The task workspace SHALL expose all generation stages as a pipeline monitor that allows the user to identify which stages are idle, active, or complete.

#### Scenario: Before generation starts
- **WHEN** no task has been started yet
- **THEN** the pipeline monitor MUST display all supported stages in an idle state

#### Scenario: Active stage is streaming
- **WHEN** chunk or status events indicate that a specific stage is currently running
- **THEN** the pipeline monitor MUST visually distinguish that stage from completed and not-yet-started stages

#### Scenario: Stage completes
- **WHEN** a stage completes and the next stage begins
- **THEN** the pipeline monitor MUST retain the completed state for the prior stage and update the new active stage accordingly

### Requirement: Focused stage output view
The interface SHALL provide a primary output reading area that focuses on one stage at a time while preserving access to all stage outputs collected during the task.

#### Scenario: Task is actively streaming
- **WHEN** a stage is currently receiving streamed content
- **THEN** the primary output area MUST default to that active stage so the user can read the latest output without manually switching views

#### Scenario: Task completes
- **WHEN** the task finishes successfully
- **THEN** the primary output area MUST default to the final `rewrite` stage if content is available

#### Scenario: User switches stage view
- **WHEN** the user selects a different pipeline stage in the workspace
- **THEN** the primary output area MUST display the stored content for that selected stage without discarding previously streamed text

### Requirement: Efficiency-first visual language
The page SHALL use a low-decoration visual system that prioritizes information density, boundary clarity, and state readability over decorative branding effects.

#### Scenario: Static visual presentation
- **WHEN** the page is rendered in its default idle state
- **THEN** the interface MUST rely on layout, labels, and restrained status color usage rather than large decorative gradients or heavily elevated card styling to communicate hierarchy

#### Scenario: Action affordance visibility
- **WHEN** the user reviews the control panel
- **THEN** the primary action for starting generation MUST remain visually prominent without dominating the page more than the task status and output workspace
