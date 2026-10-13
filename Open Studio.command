#!/bin/bash
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js 22 or newer from nodejs.org, then open this launcher again."
  read -r -p "Press Return to close. "
  exit 1
fi
node studio-workspace/open.mjs
if [ "$?" -ne 0 ]; then
  read -r -p "Press Return to close. "
fi
