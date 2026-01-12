# ZenBeats iOS Deployment Guide

### 🚀 Quick Start (Deploy to Device)
To push the code and launch it on your connected iPhone, run:
```bash
npm run run:ios
```
*Note: Make sure your iPhone is connected via USB and unlocked.*

---

### ⚠️ IMPORTANT: Fix "Untrusted Developer" Error
If you see an "Untrusted Developer" error on your phone when trying to open the app:
1. Open **Settings** on your iPhone.
2. Go to **General** -> **VPN & Device Management**.
3. Tap on your **Apple ID** (under Developer App).
4. Tap **"Trust [Your Email]"**.
5. Tap **Trust** again to confirm.

---

### 🛠 Deployment Commands Explained
1. **`npm run deploy`**: Bundles the code and opens the Xcode project. You then press the "Play" button in Xcode.
2. **`npm run run:ios`**: (Recommended) Does everything automatically—builds, syncs, and launches the app on your phone.

### 2. Xcode Configuration (Signing & Capabilities)
1. **Open Workspace**: Always use `ios/App/App.xcworkspace`.
2. **Project Settings**: Click the blue **App** icon (top left).
3. **Target Selection**: Select **App** under Targets.
4. **Signing**: 
   - Tab: `Signing & Capabilities`
   - Action: Select your **Team** (Apple ID).
5. **Background Audio (MANDATORY)**:
   - Click `+ Capability`
   - Search for `Background Modes`
   - Check `Audio, AirPlay, and Picture in Picture`.
   - *This allows the 5Hz pulses to continue when the screen is locked.*

### 3. Troubleshooting
- **No Sound?**: Ensure your iPhone's **SILENT SWITCH** (on the side) is flipped **OFF**. iOS mutes Web Audio in silent mode.
- **Untrusted Developer**: Follow the steps in the ⚠️ section above.
- **Xcode Error "No Devices"**: Ensure your iPhone is unlocked and you've tapped "Trust This Computer" on the phone screen.