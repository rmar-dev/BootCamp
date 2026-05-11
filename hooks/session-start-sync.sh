#!/usr/bin/env bash
# Hook: session-start-sync
# Checks if the pipeline template has updates and prompts to sync.
# Configured in .claude/settings.json as a session start hook.

TEMPLATE_REPO="C:/Users/ricma/Projects/claude-pipeline-template"
PROJECT_DIR="$(pwd)"
LOCK_FILE="$PROJECT_DIR/.claude-pipeline-lock"
VERSION_FILE="$PROJECT_DIR/.claude-pipeline-version"

# Skip if project isn't using the pipeline template
if [ ! -f "$VERSION_FILE" ]; then
    exit 0
fi

# Skip if template repo doesn't exist
if [ ! -d "$TEMPLATE_REPO/.git" ]; then
    echo "[pipeline] Warning: Template repo not found at $TEMPLATE_REPO"
    exit 0
fi

CURRENT_VERSION=$(cat "$VERSION_FILE" 2>/dev/null || echo "unknown")
CURRENT_SHA=$(cat "$LOCK_FILE" 2>/dev/null || echo "none")
TEMPLATE_VERSION=$(cat "$TEMPLATE_REPO/.claude-pipeline-version" 2>/dev/null || echo "unknown")
TEMPLATE_SHA=$(cd "$TEMPLATE_REPO" && git rev-parse HEAD 2>/dev/null || echo "unknown")

if [ "$CURRENT_SHA" != "$TEMPLATE_SHA" ]; then
    echo ""
    echo "=========================================="
    echo " Pipeline template has updates available"
    echo "  Current: v$CURRENT_VERSION ($CURRENT_SHA)"
    echo "  Latest:  v$TEMPLATE_VERSION ($TEMPLATE_SHA)"
    echo ""
    echo "  Run: $TEMPLATE_REPO/sync.sh $PROJECT_DIR"
    echo "=========================================="
    echo ""
fi
