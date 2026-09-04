# HandFrame — Mobile HTTPS Setup Guide

When running HandFrame on your laptop's local network, phones and other devices need to **trust the development certificate** before HTTPS works without warnings and camera access is allowed.

## Why This Is Needed

- Modern browsers require **HTTPS (Secure Context)** for camera access (`getUserMedia()`)
- The `vite-plugin-mkcert` generates a **local Certificate Authority (CA)** and uses it to sign development certificates
- This CA is automatically trusted on the laptop where `npm run dev` is run
- **Other devices** (phones, other laptops) do NOT know about this CA until you install it

## One-Time Setup Steps

### Step 1: Locate the Root CA File

After running `npm run dev` at least once, the Root CA file is generated at:

**Windows:**
```
%LOCALAPPDATA%\vite-plugin-mkcert\rootCA.pem
```

Typically:
```
C:\Users\<YourUsername>\AppData\Local\vite-plugin-mkcert\rootCA.pem
```

Or check the mkcert default directory:
```
C:\Users\<YourUsername>\AppData\Local\mkcert\rootCA.pem
```

Run `npm run diagnose:lan` to see the exact path detected on your machine.

### Step 2: Transfer the CA File to the Phone/Device

Transfer `rootCA.pem` to the target device using any of these methods:

- **AirDrop** (iPhone/Mac)
- **Email** the file to yourself and open it on the phone
- **Cloud Drive** (Google Drive, OneDrive, iCloud) — upload and download on the phone
- **USB cable** — copy to phone storage
- **QR code** — serve the file temporarily and scan from the phone

---

### Step 3: Install on iPhone / iPad (iOS)

1. Open `rootCA.pem` on the device (tap the file from email/Files app)
2. iOS will show: **"Profile Downloaded"**
3. Go to **Settings → General → VPN & Device Management**
4. Tap the downloaded profile (`mkcert …`)
5. Tap **Install** → Enter passcode → Tap **Install** again
6. Go to **Settings → General → About → Certificate Trust Settings**
7. Toggle **Enable Full Trust** for the mkcert root certificate
8. Done — Safari will now trust `https://<LAN-IP>:5173/`

### Step 4: Install on Android

1. Open `rootCA.pem` on the device (from email/Files app/Downloads)
2. Android will prompt: **"Name the certificate"**
3. Give it a name like `HandFrame Dev CA`
4. Select **VPN and apps** or **Wi-Fi** as the credential use
5. Tap **OK** or **Install**
6. Alternative: Go to **Settings → Security → Encryption & Credentials → Install a certificate → CA certificate** and select the file
7. Done — Chrome will now trust `https://<LAN-IP>:5173/`

> **Note:** On some Android versions, you may see a persistent notification saying "Network may be monitored". This is normal for user-installed CA certificates and only applies during development.

### Step 5: Install on Another Windows Laptop

1. Copy `rootCA.pem` to the other laptop
2. Double-click the file → Click **Install Certificate**
3. Select **Current User** or **Local Machine**
4. Choose **Place all certificates in the following store** → **Browse** → **Trusted Root Certification Authorities**
5. Click **Next** → **Finish**
6. Done — Chrome/Edge will now trust `https://<LAN-IP>:5173/`

### Step 6: Install on macOS

1. Copy `rootCA.pem` to the Mac
2. Double-click the file — it opens in **Keychain Access**
3. The certificate appears in the **login** keychain
4. Double-click the certificate → Expand **Trust** → Set **When using this certificate** to **Always Trust**
5. Close and enter your password
6. Done — Safari/Chrome will now trust `https://<LAN-IP>:5173/`

---

## Verifying It Works

After installing the CA certificate on the phone/device:

1. Open `https://<LAN-IP>:5173/` in Safari (iOS) or Chrome (Android)
2. The page should load **without** a "Not Secure" or certificate warning
3. Navigate to `/camera` and tap **Start HandFrame**
4. The browser should prompt for camera permission
5. If the camera works, the setup is complete!

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Not Secure" still showing | Make sure the CA is **trusted**, not just installed. On iOS, enable "Full Trust" in Certificate Trust Settings |
| Can't reach the page at all | Check Windows Firewall — run `scripts\firewall-open.bat` as Administrator |
| "This site can't be reached" | Verify both devices are on the **same Wi-Fi network** and the router allows client-to-client communication |
| Camera permission denied | The page must be HTTPS with a trusted cert. Verify `window.isSecureContext` is `true` in DevTools console |
| Certificate expired | Delete certs and restart `npm run dev` to regenerate |
| LAN IP changed | Delete old cert files and restart `npm run dev` — new certs will include the new IP |

## Regenerating Certificates

If your laptop's IP address changes (e.g., different Wi-Fi network):

1. Delete the certificate directory:
   ```
   del /s /q "%LOCALAPPDATA%\vite-plugin-mkcert\certs"
   ```
2. Restart `npm run dev` — new certificates will be generated with the current LAN IP
3. The Root CA stays the same, so phones that already have it installed will trust the new cert automatically

## Security Note

This Root CA is for **local development only**. It has no authority on the public internet. However, any device that trusts this CA will also trust any certificate signed by it. Keep the `rootCA-key.pem` file private and remove the CA from devices when you no longer need it.
