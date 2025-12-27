# Deployment Guide: Publishing draft_02 to GitHub Pages

This guide will help you publish your app online for free using GitHub Pages.

## Step 1: Set Up GitHub Account & Authentication

### Option A: Using GitHub CLI (Recommended - Easiest)

1. **Install GitHub CLI** (if not already installed):
   ```bash
   # On macOS
   brew install gh
   ```

2. **Login to GitHub**:
   ```bash
   gh auth login
   ```
   - Follow the prompts:
     - Choose "GitHub.com"
     - Choose "HTTPS" or "SSH" (HTTPS is easier)
     - Authenticate via web browser (recommended) or token
     - Follow the browser instructions to authorize

### Option B: Using Git with Personal Access Token

1. **Create a Personal Access Token**:
   - Go to https://github.com/settings/tokens
   - Click "Generate new token" → "Generate new token (classic)"
   - Give it a name like "draft_02 deployment"
   - Select scopes: `repo` (full control of private repositories)
   - Click "Generate token"
   - **Copy the token** (you won't see it again!)

2. **Configure Git** (if not already done):
   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "your.email@example.com"
   ```

## Step 2: Create GitHub Repository

### Using GitHub CLI:
```bash
cd /Users/dennis.lau/Desktop/DJ/visualizer/draft_02
gh repo create draft_02 --public --source=. --remote=origin --push
```

### Using GitHub Website:
1. Go to https://github.com/new
2. Repository name: `draft_02` (or any name you prefer)
3. Choose **Public** (required for free GitHub Pages)
4. **Don't** initialize with README, .gitignore, or license
5. Click "Create repository"

## Step 3: Initialize Git and Push Code

If you used GitHub CLI in Step 2, skip to Step 4. Otherwise:

```bash
cd /Users/dennis.lau/Desktop/DJ/visualizer/draft_02

# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: draft_02 visualizer app"

# Add remote repository (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/draft_02.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**If prompted for password**, use your Personal Access Token (not your GitHub password).

## Step 4: Enable GitHub Pages

1. Go to your repository on GitHub: `https://github.com/YOUR_USERNAME/draft_02`
2. Click **Settings** (top menu)
3. Scroll down to **Pages** (left sidebar)
4. Under **Source**, select:
   - **Source**: `GitHub Actions`
5. Save the settings

## Step 5: Update Repository Name in Config (If Needed)

If your repository name is NOT `draft_02`, update `vite.config.ts`:

```typescript
// Change 'draft_02' to your actual repository name
const base = process.env.NODE_ENV === 'production' ? '/YOUR_REPO_NAME/' : '/';
```

## Step 6: Trigger Deployment

The GitHub Actions workflow will automatically deploy when you push to the `main` branch.

1. **Check deployment status**:
   - Go to your repository
   - Click **Actions** tab
   - You should see "Deploy to GitHub Pages" workflow running
   - Wait for it to complete (green checkmark)

2. **Find your live URL**:
   - Go to **Settings** → **Pages**
   - Your site will be available at: `https://YOUR_USERNAME.github.io/draft_02/`

## Step 7: Future Updates

Whenever you make changes:

```bash
cd /Users/dennis.lau/Desktop/DJ/visualizer/draft_02
git add .
git commit -m "Your commit message"
git push
```

The site will automatically rebuild and deploy within a few minutes!

## Troubleshooting

### If deployment fails:
1. Check the **Actions** tab for error messages
2. Make sure `package.json` has correct build script: `"build": "vite build"`
3. Verify the base path in `vite.config.ts` matches your repository name

### If site shows 404:
1. Wait a few minutes (deployment can take 1-5 minutes)
2. Check that GitHub Pages is enabled in Settings → Pages
3. Verify the base path in `vite.config.ts` is correct

### If you need to change repository name:
1. Update `vite.config.ts` with new repository name
2. Commit and push the change
3. Update GitHub Pages settings if needed

## Your Live URL Format

Once deployed, your app will be available at:
```
https://YOUR_USERNAME.github.io/draft_02/
```

Replace `YOUR_USERNAME` with your actual GitHub username and `draft_02` with your repository name if different.

