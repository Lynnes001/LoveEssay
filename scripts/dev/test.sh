#!/usr/bin/env bash

set -euo pipefail

if [ ! -d .venv ]; then
  python3 -m venv .venv
fi

. .venv/bin/activate
pip install -r backend/requirements.txt
pytest backend/tests -q
