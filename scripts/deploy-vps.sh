#!/bin/bash
# Run on VPS after SSH access
# Usage: bash deploy-vps.sh

set -e

echo "=== MetaGuildX VPS Deploy ==="

# Build signer
cd apps/signer
npm install
npm run build
cd ../..

# Build web
cd apps/web
npm run build
cd ../..

# Build admin
cd apps/admin
npm run build
cd ../..

# Copy built files
sudo mkdir -p /var/www/web/dist /var/www/admin/dist
sudo cp -r apps/web/dist/* /var/www/web/dist/
sudo cp -r apps/admin/dist/* /var/www/admin/dist/

# Start/reload PM2
set -a
source /etc/metaguildx/signer.env
set +a
pm2 start ecosystem.config.js --env production
pm2 save

# Reload nginx
sudo nginx -t && sudo systemctl reload nginx

echo "=== Deploy Complete ==="
