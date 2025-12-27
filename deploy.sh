#!/bin/bash

echo "🚀 Initializing Git repository..."
git init

echo "📦 Adding files..."
git add .

echo "💾 Creating initial commit..."
git commit -m "Initial commit: audio-visual interactive experience"

echo ""
echo "✅ Repository initialized!"
echo ""
echo "Next steps:"
echo "1. Create a new repository on GitHub (name it 'draft_02' or your choice)"
echo "2. Run these commands (replace YOUR_USERNAME with your GitHub username):"
echo ""
echo "   git remote add origin https://github.com/YOUR_USERNAME/draft_02.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "3. Go to your repo Settings > Pages"
echo "4. Select 'Deploy from a branch' > 'main' > '/' > Save"
echo ""
echo "Your app will be live at: https://YOUR_USERNAME.github.io/draft_02/"

