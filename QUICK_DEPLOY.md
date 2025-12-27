# Quick Deploy to GitHub Pages

## 🚀 Fast Track (5 minutes)

### 1. Create GitHub Repository
- Go to https://github.com/new
- Name: `draft_02`
- **Public** (required for free Pages)
- **Don't** add README/license
- Click **Create**

### 2. Run These Commands

```bash
cd draft_02

# Initialize and commit
git init
git add .
git commit -m "Initial commit"

# Connect to GitHub (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/draft_02.git
git branch -M main
git push -u origin main
```

### 3. Enable GitHub Pages
- Go to your repo → **Settings** → **Pages**
- Source: **Deploy from a branch**
- Branch: `main` / Folder: `/ (root)`
- Click **Save**

### 4. Wait for Deployment
- Go to **Actions** tab
- Wait for workflow to complete (2-3 minutes)
- Your app will be live at:
  ```
  https://YOUR_USERNAME.github.io/draft_02/
  ```

## 📝 Important Notes

- If you use a **different repo name**, update `vite.config.ts` line 7:
  ```typescript
  const base = process.env.NODE_ENV === 'production' ? '/YOUR_REPO_NAME/' : '/';
  ```

- The deployment happens automatically on every push to `main`

- First deployment takes 3-5 minutes, subsequent updates are faster

## ✅ Done!

Your interactive audio-visual experience is now live and accessible to anyone with the link.

