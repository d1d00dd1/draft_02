# Authenticate with d1d00dd1 GitHub Account

## Step 1: Clear Old Credentials

Run this in your terminal:

```bash
cd /Users/dennis.lau/Desktop/DJ/visualizer/draft_02

# Remove stored GitHub credentials
git credential-osxkeychain erase <<EOF
host=github.com
protocol=https
EOF
```

## Step 2: Create Personal Access Token

1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Name it: `draft_02_deploy`
4. Select expiration (30 days, 90 days, or no expiration)
5. Check the **`repo`** scope (this gives full repository access)
6. Click **"Generate token"**
7. **COPY THE TOKEN** (you won't see it again!)

## Step 3: Push with New Credentials

```bash
cd /Users/dennis.lau/Desktop/DJ/visualizer/draft_02

# Make sure remote is correct
git remote set-url origin https://github.com/d1d00dd1/draft_02.git

# Push (it will ask for username and password)
git push -u origin main
```

When prompted:
- **Username:** `d1d00dd1`
- **Password:** Paste your Personal Access Token (not your GitHub password)

## Alternative: Use SSH (if you have SSH keys set up)

If you have SSH keys for d1d00dd1:

```bash
cd /Users/dennis.lau/Desktop/DJ/visualizer/draft_02

# Switch to SSH
git remote set-url origin git@github.com:d1d00dd1/draft_02.git

# Push
git push -u origin main
```

