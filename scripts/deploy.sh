
#!/bin/bash

# FreeTrust Deploy Script
# Commits all changes and pushes to GitHub to trigger Vercel deployment

set -e

echo "========================================="
echo "  FreeTrust Deploy Script"
echo "========================================="

# Navigate to project root
cd ~/freetrust

echo ""
echo "[1/4] Checking git status..."
git status

echo ""
echo "[2/4] Staging all changes..."
git add .

echo ""
echo "[3/4] Committing changes..."
git commit -m "Add marketplace, events, community, dashboard, agents" || echo "Nothing new to commit — working tree clean."

echo ""
echo "[4/4] Pushing to GitHub (main branch)..."
git push origin main

echo ""
echo "========================================="
echo "  ✅ Push complete!"
echo "  Vercel will auto-deploy from:"
echo "  https://github.com/davidocallaghan100-ctrl/freetrust"
echo ""
echo "  Monitor deployment at:"
echo "  https://vercel.com/dashboard"
echo ""
echo "  Live site:"
echo "  https://freetrust.vercel.app"
echo "========================================="
echo ""
echo "  📣 Reporting to #os-commands:"
echo "  > Push to main complete. Vercel deployment triggered."
echo "  > Site will be live at https://freetrust.vercel.app"
echo "  > Commit: 'Add marketplace, events, community, dashboard, agents'"
echo "========================================="