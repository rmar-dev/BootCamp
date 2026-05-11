#!/usr/bin/env bash
# Hook: post-edit-test
# Auto-runs relevant tests after file edits in Claude Code.
# Detects project type and uses the appropriate test runner.
# Receives the edited file path as $1.

EDITED_FILE="${1:-}"
PROJECT_DIR="$(pwd)"

if [ -z "$EDITED_FILE" ]; then
    exit 0
fi

# Skip test/config/doc files
case "$EDITED_FILE" in
    *.test.* | *_test.* | *.spec.* | *.md | *.json | *.yml | *.yaml | *.toml | *.lock)
        exit 0
        ;;
esac

# Detect project type and run tests
if [ -f "$PROJECT_DIR/package.json" ]; then
    # Node.js project
    if grep -q '"test"' "$PROJECT_DIR/package.json" 2>/dev/null; then
        echo "[test] Running: npm test"
        npm test 2>&1 | tail -20
    fi

elif [ -f "$PROJECT_DIR/go.mod" ]; then
    # Go project — test the package containing the edited file
    DIR=$(dirname "$EDITED_FILE")
    echo "[test] Running: go test ./$DIR/..."
    go test "./$DIR/..." -v -count=1 2>&1 | tail -20

elif ls "$PROJECT_DIR"/*.csproj 1>/dev/null 2>&1 || ls "$PROJECT_DIR"/*.sln 1>/dev/null 2>&1; then
    # .NET/C# project
    echo "[test] Running: dotnet test"
    dotnet test 2>&1 | tail -20

elif [ -f "$PROJECT_DIR/Cargo.toml" ]; then
    # Rust project
    echo "[test] Running: cargo test"
    cargo test 2>&1 | tail -20

elif [ -f "$PROJECT_DIR/pyproject.toml" ] || [ -f "$PROJECT_DIR/setup.py" ]; then
    # Python project
    if [ -f "$PROJECT_DIR/pyproject.toml" ] && grep -q "pytest" "$PROJECT_DIR/pyproject.toml" 2>/dev/null; then
        echo "[test] Running: pytest"
        pytest 2>&1 | tail -20
    elif command -v pytest &>/dev/null; then
        echo "[test] Running: pytest"
        pytest 2>&1 | tail -20
    fi

elif [ -f "$PROJECT_DIR/Makefile" ] && grep -q "^test:" "$PROJECT_DIR/Makefile" 2>/dev/null; then
    # Makefile with test target
    echo "[test] Running: make test"
    make test 2>&1 | tail -20
fi
