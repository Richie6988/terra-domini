#!/bin/bash
# AGENT_CMD wrapper for the Claude Code CLI: bash agents/claude_agent.sh PROMPT_FILE
exec claude -p --dangerously-skip-permissions "$(cat "$1")"
