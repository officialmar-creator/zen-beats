
# ZenBeats: 5Hz Theta Meditation App

A high-performance binaural beats application designed for deep focus and meditation. 

## 🌐 Easy Web Deployment (No Terminal Required)

If you have trouble using the Command Line (Git) because of Google Sign-in:

### 1. Uploading to GitHub via Browser
1. Create a new Repository on GitHub.
2. Click **"uploading an existing file"** on the setup screen.
3. **CRITICAL:** Drag and drop your source files and folders into the window:
   - `App.tsx`, `index.tsx`, `index.html`, `package.json`, `manifest.json`, `types.ts`, `capacitor.config.json`
   - **Folders:** `components/` and `services/`
4. **EXCEPTIONS:** Do NOT upload `node_modules/` or the `public/` folder.
5. Click **Commit changes**.

### 2. Hosting on Vercel (Free)
1. Go to [Vercel.com](https://vercel.com).
2. Connect your GitHub account.
3. Import your repository (or create a new project with a unique name, e.g. `zenbeats-v2` or `zenbeats-delta`, to ensure a new dedicated URL without overwriting your existing deployment).
4. **Project Settings:**
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Click **Deploy**. Vercel will assign a new, unique domain (e.g., `zenbeats-v2.vercel.app` plus a unique preview URL for every deployment).

---

## 📱 Mobile App Features
- **5Hz Theta Pulse:** Precisely engineered binaural frequency for deep relaxation.
- **Ambient Mixer:** Layer ocean, rain, wind, or forest sounds.
- **Background Play:** Works even when your screen is locked (if installed as a PWA or iOS App).
- **Session Timer:** Auto-fade out and stop when your session ends.

---

## 🛠 Advanced: iOS Native Deployment
If you want to use the native iOS features via Capacitor:

1. **Run:** `npm run run:ios` (Requires a Mac with Xcode).
2. **Trust Developer:** Go to Settings -> General -> VPN & Device Management on your iPhone to trust your Apple ID.
3. **Background Audio:** Ensure "Background Modes" is enabled in Xcode with "Audio" checked.

## ⚠️ Important Note on Audio
Ensure your iPhone's **SILENT SWITCH** (the physical button on the side) is flipped **OFF**. iOS blocks web-based audio if the phone is in silent/vibrate mode.
