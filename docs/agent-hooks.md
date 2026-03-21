# Agent Hook Examples

## Claude Code

`~/.claude/settings.json`:
```json
{
  "hooks": {
    "Notification": [{
      "matcher": "idle_prompt",
      "hooks": [{
        "type": "command",
        "command": "vmux notify --title 'Claude Code' --body 'Waiting for input'"
      }]
    }],
    "Stop": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "vmux notify --title 'Claude Code' --body 'Task complete' --level info"
      }]
    }]
  }
}
```

## Codex

`~/.codex/config.toml`:
```toml
notify = ["bash", "-c", "vmux notify --title Codex --body 'Done'"]
```

## Gemini CLI

`~/.gemini/settings.json`:
```json
{
  "hooks": {
    "on_complete": "vmux notify --title 'Gemini CLI' --body 'Task finished'"
  }
}
```

## Shell Script (Generic)

Any agent or script can send notifications:
```bash
# Simple notification
vmux notify --title "Build" --body "Complete"

# Error notification
vmux notify --title "Test" --body "3 tests failed" --level error

# After long-running command
npm test && vmux notify --title "Tests" --body "All passed" \
         || vmux notify --title "Tests" --body "Failed" --level error
```

## Setup

1. Install the vmux VS Code extension
2. Ensure `vmux` is in your PATH:
   ```bash
   npm install -g vmux
   # or the extension bundles it at: ~/.vscode/extensions/roboco-io.vmux-*/dist/cli.js
   ```
3. Open a terminal in VS Code — the extension auto-injects `VMUX_SOCKET`
4. Configure your agent's hook as shown above
