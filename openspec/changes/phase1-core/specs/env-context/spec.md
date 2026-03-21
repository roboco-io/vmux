## ADDED Requirements

### Requirement: Automatic environment variable injection

All terminals managed by the extension SHALL receive injected `VMUX_*` environment variables.

#### Scenario: Terminal created by the extension
- **WHEN** a terminal is created through a `terminal.create` request
- **THEN** the following environment variables SHALL be set automatically:
  - `VMUX_TERMINAL_ID`: unique terminal identifier
  - `VMUX_WORKSPACE`: VS Code workspace name
  - `VMUX_SESSION`: current session name (or an empty string)
  - `VMUX_SOCKET`: IPC socket path or HTTP URL
  - `VMUX_CWD`: initial working directory

#### Scenario: Terminal created through `TerminalProfileProvider`
- **WHEN** the user opens a terminal by selecting the vmux terminal profile
- **THEN** the same `VMUX_*` environment variables SHALL be injected

#### Scenario: Merge with user environment variables
- **WHEN** a `terminal.create` request includes an `env` parameter and does not define `VMUX_*` keys
- **THEN** the user environment variables and the `VMUX_*` variables SHALL be merged
- **THEN** if the user explicitly provides a `VMUX_*` key, the user value SHALL take precedence

### Requirement: `TerminalProfileProvider` registration

The vmux terminal profile SHALL be registered in VS Code.

#### Scenario: Register the profile
- **WHEN** the extension activates
- **THEN** a terminal profile named `"vmux"` SHALL be registered in VS Code
- **THEN** the user SHALL be able to select it from the terminal dropdown

#### Scenario: Create a terminal from the profile
- **WHEN** the user creates a terminal by selecting the `"vmux"` profile
- **THEN** the created terminal SHALL use the default shell and include the `VMUX_*` environment variables

### Requirement: Customizable environment variable prefix

The environment variable prefix SHALL be configurable.

#### Scenario: Default prefix
- **WHEN** the `vmux.envPrefix` setting uses its default value of `VMUX`
- **THEN** the environment variable names SHALL be generated as `VMUX_*`

#### Scenario: Custom prefix
- **WHEN** the `vmux.envPrefix` setting is changed to `MY_AGENT`
- **THEN** the environment variable names SHALL be generated as `MY_AGENT_TERMINAL_ID`, `MY_AGENT_WORKSPACE`, and so on

### Requirement: Terminals TreeView

The sidebar SHALL display the list of managed terminals in a TreeView.

#### Scenario: Show the terminal list
- **WHEN** the Terminals TreeView is open
- **THEN** all terminals managed by the extension SHALL be shown with their names
- **THEN** each terminal SHALL display its CWD and active/closed state

#### Scenario: Focus when clicking a terminal
- **WHEN** the user clicks a terminal item in the TreeView
- **THEN** focus SHALL move to that terminal

#### Scenario: Detect terminal shutdown
- **WHEN** a terminal managed by the extension is closed
- **THEN** the corresponding item SHALL be removed from the TreeView or marked as closed
