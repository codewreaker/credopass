#!/usr/bin/env bash
find . -type d -name "node_modules" -prune -exec rm -rf {} + && find . -name "bun.lock" -type f -delete && echo "✅ All node_modules and bun.lockb files deleted"