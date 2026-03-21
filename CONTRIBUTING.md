# Contributing Guide

Thanks for contributing to vmux.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/roboco-io/tools.git
cd tools/vmux

# Install dependencies
npm install

# Build
npm run build

# Development mode (watch files and rebuild automatically)
npm run watch
```

In VS Code, press `F5` to launch an Extension Development Host.

## Project Structure

```text
src/
├── extension/   # VS Code extension host code (IPC server, notifications, sessions, terminal management)
├── cli/         # vmux CLI used by agents and external tools
├── mcp/         # MCP server integration
├── shared/      # Shared types, protocol definitions, and utilities
└── test/        # Unit tests and E2E tests
```

## Code Style

- Use **TypeScript strict mode** (`strict: true` in `tsconfig.json`)
- Bundle with **esbuild** and emit CommonJS output
- If lint or format settings are present, run `npm run lint` before submitting changes

## Testing

```bash
# Unit and integration tests
npm test

# E2E tests (VS Code Extension Test Runner)
npm run test:e2e
```

Make sure the test suite passes before opening a pull request.

## Pull Request Process

1. **Fork** the repository.
2. Create a **branch** that matches the feature or fix (`feat/notification-improvements`, `fix/socket-timeout`, etc.).
3. Commit your changes and push them to your fork.
4. Open a **Pull Request** against the upstream repository.

## Commit Message Convention

Follow the [Conventional Commits](https://www.conventionalcommits.org/) format.

```text
<type>(<scope>): <description>

[optional body]
```

**Common types:**

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation change |
| `refactor` | Refactoring with no behavior change |
| `test` | Test addition or update |
| `chore` | Build, configuration, or other maintenance work |

**Examples:**

```text
feat(notification): focus the sidebar when the badge is clicked
fix(ipc): handle Unix socket connection timeouts
docs: add CONTRIBUTING.md
```
