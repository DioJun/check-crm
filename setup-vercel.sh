#!/bin/bash

# Checkmate CRM - Vercel + Supabase Setup Script
# Execute: ./setup-vercel.sh

echo "================================"
echo "Checkmate CRM - Vercel Setup"
echo "================================"
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "⚠️  Vercel CLI not found. Installing..."
    npm install -g vercel
fi

echo "📝 Supabase Connection String (from supabase.com):"
read -p "DATABASE_URL = " DATABASE_URL

echo ""
echo "🔐 JWT Secret (random string, min 32 chars):"
read -p "JWT_SECRET = " JWT_SECRET

echo ""
echo "🌐 Frontend URL (will add later after deployment):"
read -p "CORS_ORIGIN = " CORS_ORIGIN

echo ""
echo "================================"
echo "Deploying Backend..."
echo "================================"

cd backend

echo ""
echo "Add these environment variables in Vercel:"
echo "  DATABASE_URL = $DATABASE_URL"
echo "  JWT_SECRET = $JWT_SECRET"
echo "  CORS_ORIGIN = $CORS_ORIGIN"
echo "  NODE_ENV = production"
echo ""

vercel --prod

echo ""
echo "✅ Backend deployed!"
echo ""
echo "Next steps:"
echo "1. Copy backend URL from Vercel"
echo "2. Update CORS_ORIGIN with frontend URL"
echo "3. Deploy frontend with:"
echo "   cd ../frontend && vercel --prod"
echo ""
