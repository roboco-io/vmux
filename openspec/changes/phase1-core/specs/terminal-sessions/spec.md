## ADDED Requirements

### Requirement: Save session presets

The system SHALL be able to save the current set of open terminals as a named preset.

#### Scenario: Save a session
- **WHEN** a `session.save` request is received with a `name` parameter
- **THEN** the system SHALL capture the name, CWD, environment variables, and shell path of all currently open terminals
- **THEN** it SHALL save the preset to `.vscode/vmux-sessions.json` under that name

#### Scenario: Overwrite a session with the same name
- **WHEN** a save request is received for a session name that already exists
- **THEN** the existing preset SHALL be overwritten with the new state

#### Scenario: Save a session from the Command Palette
- **WHEN** the user runs `vmux: Save Session` from the Command Palette
- **THEN** a prompt for the session name SHALL be shown
- **THEN** the current terminal state SHALL be saved after the user provides a name

### Requirement: Restore session presets

The system SHALL be able to restore terminals from a saved preset.

#### Scenario: Restore a session
- **WHEN** a `session.restore` request is received with a `name` parameter
- **THEN** each terminal defined in the preset SHALL be created with its name, CWD, environment variables, and shell path

#### Scenario: Restore split terminal groups
- **WHEN** the preset contains multiple terminals with the same `group` number
- **THEN** those terminals SHALL be restored as a split group

#### Scenario: Restore a session that does not exist
- **WHEN** a restore request is received for a session name that has not been saved
- **THEN** a `"Session not found"` error SHALL be returned

#### Scenario: Restore a session from the Command Palette
- **WHEN** the user runs `vmux: Restore Session` from the Command Palette
- **THEN** the saved session list SHALL be shown in a QuickPick
- **THEN** the selected session SHALL be restored

### Requirement: List session presets

The system SHALL be able to list saved session presets.

#### Scenario: Return the session list
- **WHEN** a `session.list` request is received
- **THEN** the response SHALL include the names of all saved session presets and their terminal counts

### Requirement: Sessions TreeView

The sidebar SHALL display saved sessions in a TreeView.

#### Scenario: Show the session list
- **WHEN** the Sessions TreeView is open
- **THEN** all saved session presets SHALL be displayed
- **THEN** each session SHALL display its terminal names and CWD values underneath

#### Scenario: Restore from the TreeView
- **WHEN** the user clicks the restore button on a session item in the TreeView
- **THEN** that session SHALL be restored

#### Scenario: Delete from the TreeView
- **WHEN** the user clicks the delete button on a session item in the TreeView
- **THEN** that session preset SHALL be removed from `.vscode/vmux-sessions.json`

### Requirement: Auto-restore

The system SHALL be able to restore the last terminal state automatically when the workspace opens.

#### Scenario: Auto-restore enabled
- **WHEN** `vmux.autoRestore` is `true` and the workspace is opened
- **THEN** the last saved terminal state SHALL be restored automatically

#### Scenario: Auto-restore disabled
- **WHEN** `vmux.autoRestore` is `false`
- **THEN** auto-restore MUST NOT run
