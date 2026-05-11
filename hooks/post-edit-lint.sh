#!/usr/bin/env bash
# Hook: post-edit-lint
# Auto-lints files after Claude Code edits.
# Detects project type and uses the appropriate linter.
# Receives the edited file path as $1.

EDITED_FILE="${1:-}"
PROJECT_DIR="$(pwd)"

if [ -z "$EDITED_FILE" ]; then
    exit 0
fi

# Skip non-source files
case "$EDITED_FILE" in
    *.md | *.txt | *.json | *.yml | *.yaml | *.lock | *.gitkeep)
        exit 0
        ;;
esac

# JavaScript/TypeScript
case "$EDITED_FILE" in
    *.js | *.jsx | *.ts | *.tsx)
        if [ -f "$PROJECT_DIR/eslint.config.js" ] || [ -f "$PROJECT_DIR/eslint.config.mjs" ] || [ -f "$PROJECT_DIR/.eslintrc.js" ] || [ -f "$PROJECT_DIR/.eslintrc.json" ] || [ -f "$PROJECT_DIR/.eslintrc" ]; then
            echo "[lint] Running: eslint --fix $EDITED_FILE"
            npx eslint --fix "$EDITED_FILE" 2>&1 | tail -10
        fi
        ;;
esac

# Go
case "$EDITED_FILE" in
    *.go)
        echo "[lint] Running: gofmt -w $EDITED_FILE"
        gofmt -w "$EDITED_FILE" 2>/dev/null
        if command -v golangci-lint &>/dev/null; then
            echo "[lint] Running: golangci-lint run $EDITED_FILE"
            golangci-lint run "$EDITED_FILE" 2>&1 | tail -10
        fi
        ;;
esac

# C#
case "$EDITED_FILE" in
    *.cs)
        if command -v dotnet-format &>/dev/null || command -v dotnet &>/dev/null; then
            echo "[lint] Running: dotnet format"
            dotnet format --include "$EDITED_FILE" 2>&1 | tail -10
        fi
        ;;
esac

# Python
case "$EDITED_FILE" in
    *.py)
        if command -v ruff &>/dev/null; then
            echo "[lint] Running: ruff check --fix $EDITED_FILE"
            ruff check --fix "$EDITED_FILE" 2>&1 | tail -10
        elif command -v black &>/dev/null; then
            echo "[lint] Running: black $EDITED_FILE"
            black "$EDITED_FILE" 2>&1 | tail -10
        fi
        ;;
esac

# Rust
case "$EDITED_FILE" in
    *.rs)
        if command -v rustfmt &>/dev/null; then
            echo "[lint] Running: rustfmt $EDITED_FILE"
            rustfmt "$EDITED_FILE" 2>&1 | tail -10
        fi
        ;;
esac
