#!/usr/bin/env bash
# Exit immediately if any command exits with a non-zero status
set -o errexit

echo "==== STARTING MONOREPO BUILD COMMAND ===="

# 1. Build the React Frontend
echo "Building React Frontend..."
cd frontend
if [ -f yarn.lock ]; then
    yarn install --frozen-lockfile
    yarn build
else
    npm install
    npm run build
fi

# 2. Build the Python Backend
echo "Building Python Backend..."
cd ../backend
pip install --upgrade pip
pip install -r requirements.txt

echo "==== MONOREPO BUILD COMPLETE ===="
