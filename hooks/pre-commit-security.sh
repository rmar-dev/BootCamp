#!/usr/bin/env bash
# Hook: pre-commit-security
# Lightweight pre-commit security scan on staged files.
# For the full Security Gateway (code-scanner + architecture-reviewer + audit-logger),
# the orchestrator runs those agents. This hook catches the most critical issues fast.

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null)

if [ -z "$STAGED_FILES" ]; then
    exit 0
fi

BLOCKED=0
FINDINGS=""

for file in $STAGED_FILES; do
    # Skip binary files and non-text files
    if ! file "$file" 2>/dev/null | grep -q "text"; then
        continue
    fi

    # Skip files that don't exist (deleted)
    if [ ! -f "$file" ]; then
        continue
    fi

    content=$(cat "$file" 2>/dev/null || true)

    # --- Secrets Detection ---
    # AWS Access Keys
    if echo "$content" | grep -qE 'AKIA[0-9A-Z]{16}'; then
        FINDINGS="$FINDINGS\n  [CRITICAL] AWS Access Key found in $file"
        BLOCKED=1
    fi

    # Generic secrets patterns
    if echo "$content" | grep -qiE '(password|secret|token|api_key|apikey)\s*=\s*["\x27][^"\x27]{8,}'; then
        # Exclude common false positives (env var references, placeholders)
        if ! echo "$content" | grep -qE '(process\.env|os\.environ|os\.Getenv|Environment\.GetEnvironmentVariable|\$\{|<your-|example|placeholder|TODO)'; then
            FINDINGS="$FINDINGS\n  [CRITICAL] Possible hardcoded secret in $file"
            BLOCKED=1
        fi
    fi

    # Connection strings
    if echo "$content" | grep -qE '(postgres|mysql|mongodb|redis)://[^$\{].*@'; then
        FINDINGS="$FINDINGS\n  [CRITICAL] Hardcoded connection string in $file"
        BLOCKED=1
    fi

    # Private keys
    if echo "$content" | grep -qE 'BEGIN (RSA |DSA |EC |OPENSSH )?PRIVATE KEY'; then
        FINDINGS="$FINDINGS\n  [CRITICAL] Private key found in $file"
        BLOCKED=1
    fi
done

if [ $BLOCKED -eq 1 ]; then
    echo ""
    echo "=========================================="
    echo " SECURITY GATE: BLOCKED"
    echo ""
    echo -e "$FINDINGS"
    echo ""
    echo " Fix these issues before committing."
    echo " To bypass (NOT recommended): git commit --no-verify"
    echo "=========================================="
    echo ""
    exit 1
fi

echo "[security] Pre-commit scan: CLEAN ($( echo "$STAGED_FILES" | wc -w) files)"
