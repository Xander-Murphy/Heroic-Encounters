# Hosting the shared server (free)

This puts Heroic Encounters online so anyone can play from a link, create an account, and share content with everyone else. It costs nothing and needs no credit card.

```text
  Player's browser
        │
        ▼
 GitHub Pages ───────▶ Render ────────────────▶ MongoDB Atlas
 the game (web/)       the server/ code          the database
 free                  free (sleeps when idle)   free (512 MB)
```

| Piece | What it does |
| --- | --- |
| **MongoDB Atlas** | Stores accounts, saves and community content. |
| **Render** | Runs the `server/` code: logins, checking uploads, merging saves. Runs on Render's computers, not yours. |
| **GitHub Pages** | Gives players a link to the game. |

Do the steps in order; each one needs something from the one before. Allow about 30 minutes.

---

## 1. MongoDB Atlas: the database

1. Sign up at <https://www.mongodb.com/cloud/atlas/register> (signing in with Google or GitHub is fine).
2. When asked to deploy a cluster, choose **M0 / Free**. Any provider and region is fine; pick one near you. Click **Create Deployment**.
3. **Create a database user.** Atlas suggests a username and password. Click **Autogenerate Secure Password** so it contains only letters and numbers, then **copy the password somewhere safe** before continuing.
4. **Network access.** In the left menu go to **Security → Network Access → Add IP Address → Allow Access from Anywhere** (`0.0.0.0/0`) → **Confirm**.
   Render's free tier has no fixed address, so this is required. The database is still protected by the user's password.
5. **Get the connection string.** Go to **Database → Clusters → Connect → Drivers**. Copy the string that looks like:
   ```text
   mongodb+srv://<user>:<db_password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```
   Replace `<db_password>` (including the `<` `>`) with the password from step 3. Keep this string private; it is the key to your database.

## 2. Render: the server

1. Sign up at <https://render.com> with your GitHub account, and allow it to see the `Heroic-Encounters` repository.
2. Click **New → Blueprint**, pick the `Heroic-Encounters` repository and the branch to deploy (`main`). Render reads [`render.yaml`](../render.yaml) and sets everything up.
3. It asks for **`MONGODB_URI`**: paste the connection string from step 1.5. Click **Apply** / **Deploy**.
4. Wait until the service says **Live** (a few minutes the first time). Copy its address at the top, e.g. `https://heroic-encounters-ab12.onrender.com`.
5. Check it: open `https://<your-address>/api/health`. You should see `{"ok":true,"storage":"mongo",…}`.

> **If Blueprint isn't offered or asks for payment**, use **New → Web Service** instead, pick the repository and fill in:
> Runtime **Node** · Build command `npm ci` · Start command `npm start` · Instance type **Free** ·
> Environment variables: `MONGODB_URI` = your connection string, `NODE_VERSION` = `22.14.0`.

## 3. Point the game at your server

Open [`web/js/config.js`](../web/js/config.js) and put your Render address in:

```js
export const DEFAULT_SERVER_URL = 'https://heroic-encounters-ab12.onrender.com';
```

No slash at the end. Commit and push. From now on every copy of the game uses this server: the GitHub Pages site and anyone who downloads the repository and runs `npm start`. Render redeploys automatically when you push.

## 4. GitHub Pages: the game

1. Make sure your changes are on `main` (merge your branch first). The publish workflow only runs for `main`.
2. On GitHub, open the repository → **Settings → Pages**. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Go to the **Actions** tab. **Deploy game to GitHub Pages** runs on every push to `main` that changes `web/`. To run it now, open it and click **Run workflow**.
4. When it's green, the game is at:
   **<https://xander-murphy.github.io/Heroic-Encounters/>**

## 5. Try it

Open the game link. The top right shows **● Connecting…** for up to a minute if the server was asleep, then **● Online**. Go to **Settings → Account**, create an account, and play. Open the link in another browser, sign in, and your progress is there.

---

## Good to know

- **Sleeping server.** Render's free tier sleeps after 15 minutes without visitors. The next visitor waits up to a minute for accounts and community features; the game itself is playable immediately. Before a demo or grading, open the link a minute early to wake it.
- **Free limits.** Render gives 750 free hours a month, enough for one service running all month. Atlas M0 holds 512 MB, which is a lot of heroes and saves.
- **Where your data lives.** In Atlas under **Database → Browse Collections → heroic-encounters**: `users`, `saves`, `content`, and so on. Passwords are stored only as scrypt hashes.
- **Local development is unchanged.** `npm start` without `MONGODB_URI` uses `data/community.db` (SQLite) and needs no `npm install`. To run the API tests against MongoDB too, set `MONGODB_TEST_URI` (e.g. `mongodb://127.0.0.1:27017`) and run `npm test`.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Game always shows **● Offline** | `DEFAULT_SERVER_URL` is wrong (typo, trailing slash, `http` instead of `https`), or the Render service isn't Live. Open `/api/health` on the Render address. |
| Render logs show `MongoServerSelectionError` | Atlas Network Access doesn't allow `0.0.0.0/0` (step 1.4). |
| Render logs show `bad auth` / `Authentication failed` | The password in `MONGODB_URI` is wrong or still contains `<db_password>`. |
| Render build fails on the Node version | `NODE_VERSION` must be 22.5 or newer. |
| Pages workflow fails with "not allowed to deploy" | It was run from a branch other than `main`. Merge first. |
