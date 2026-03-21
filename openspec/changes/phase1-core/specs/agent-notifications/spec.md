## ADDED Requirements

### Requirement: Notification creation and storage

Notifications received through IPC SHALL be stored in memory.

#### Scenario: Create a notification
- **WHEN** a `notification.create` request is received with `title`, `body`, and `level` parameters
- **THEN** a notification SHALL be created with a unique ID, timestamp, and `read: false`
- **THEN** the response SHALL return the created notification ID

#### Scenario: Link a notification to a terminal
- **WHEN** a `notification.create` request includes the `terminalId` parameter
- **THEN** the notification SHALL be associated with the specified terminal

#### Scenario: Missing required parameters
- **WHEN** a `notification.create` request is received without `title`
- **THEN** an Invalid params error SHALL be returned

### Requirement: Notification listing and deletion

The system SHALL provide notification listing and deletion.

#### Scenario: List all notifications
- **WHEN** a `notification.list` request is received
- **THEN** all notifications SHALL be returned in reverse timestamp order (newest first)

#### Scenario: Delete a specific notification
- **WHEN** a `notification.clear` request specifies an `id`
- **THEN** only the notification with that ID SHALL be deleted

#### Scenario: Delete all notifications
- **WHEN** a `notification.clear` request does not include an `id`
- **THEN** all notifications SHALL be deleted

### Requirement: StatusBar badge

The VS Code status bar SHALL display the unread notification count.

#### Scenario: Unread notifications exist
- **WHEN** at least one unread notification exists
- **THEN** the StatusBar SHALL show the unread count
- **THEN** the icon SHALL appear in an active state (bell icon)

#### Scenario: All notifications are read
- **WHEN** the unread notification count is `0`
- **THEN** the StatusBar badge SHALL be hidden or shown in an inactive state

#### Scenario: Click the StatusBar badge
- **WHEN** the user clicks the StatusBar badge
- **THEN** the Notifications TreeView SHALL receive focus

### Requirement: Notifications TreeView

The system SHALL display notifications in a sidebar TreeView.

#### Scenario: Show the notification list
- **WHEN** the Notifications TreeView is open
- **THEN** all notifications SHALL be shown in reverse timestamp order
- **THEN** each notification SHALL display an icon that matches its level (`info` / `warning` / `error`)

#### Scenario: Focus terminal when clicking a notification
- **WHEN** the user clicks a notification that is linked to a terminal
- **THEN** focus SHALL move to that terminal
- **THEN** the notification SHALL be marked `read: true`

#### Scenario: Click a notification without a terminal
- **WHEN** the user clicks a notification that is not linked to a terminal
- **THEN** the notification SHALL be marked `read: true`

### Requirement: Notification jump shortcut

The user SHALL be able to move to the latest unread notification with a keyboard shortcut.

#### Scenario: Execute the shortcut when unread notifications exist
- **WHEN** the user presses `Cmd+Shift+U` (macOS) or `Ctrl+Shift+U` (Windows/Linux)
- **THEN** focus SHALL move to the terminal linked to the most recent unread notification
- **THEN** that notification SHALL be marked `read: true`

#### Scenario: Execute the shortcut when there are no unread notifications
- **WHEN** the user presses the shortcut while there are no unread notifications
- **THEN** a `"No unread notifications"` message SHALL be shown

### Requirement: System notification integration

The system SHALL be able to show OS-level notifications when a new notification is received.

#### Scenario: System notifications enabled
- **WHEN** a new notification is received and `vmux.systemNotifications` is `true`
- **THEN** `vscode.window.showInformationMessage()` SHALL be called, or its warning/error variant based on the level

#### Scenario: System notifications disabled
- **WHEN** a new notification is received and `vmux.systemNotifications` is `false`
- **THEN** a VS Code popup message MUST NOT be shown
- **THEN** the TreeView and StatusBar SHALL still update normally
