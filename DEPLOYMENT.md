# GitHub Deployment Guide

## Step 1: Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and log in
2. Click the **+** icon in the top right → **New repository**
3. Repository name: `draft_02` (or your preferred name)
4. Set to **Public** (required for free GitHub Pages)
5. **DO NOT** initialize with README, .gitignore, or license
6. Click **Create repository**

## Step 2: Upload Your Code

Run these commands in your terminal (from the `draft_02` directory):

```bash
cd draft_02

# Initialize git (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: audio-visual interactive experience"

# Add your GitHub repository as remote
# Replace YOUR_USERNAME with your actual GitHub username
git remote add origin https://github.com/YOUR_USERNAME/draft_02.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** tab
3. Scroll to **Pages** in the left sidebar
4. Under **Source**, select:
   - **Deploy from a branch**
   - Branch: `main`
   - Folder: `/ (root)`
5. Click **Save**

## Step 4: Configure GitHub Actions

The repository already includes `.github/workflows/deploy.yml` which will automatically:
- Build your app when you push to `main`
- Deploy to GitHub Pages

**Important:** After your first push, go to the **Actions** tab in your repository to see the deployment progress.

## Step 5: Update Base Path (if needed)

If your repository name is different from `draft_02`, update `vite.config.ts`:

```typescript
const base = process.env.NODE_ENV === 'production' ? '/YOUR_REPO_NAME/' : '/';
```

## Access Your App

Once deployed, your app will be available at:
```
https://YOUR_USERNAME.github.io/draft_02/
```

## Future Updates

To update your live app:
```bash
git add .
git commit -m "Update description"
git push
```

GitHub Actions will automatically rebuild and redeploy.

