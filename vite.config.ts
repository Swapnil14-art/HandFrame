import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';
import os from 'os';

/**
 * Detects all physical (non-virtual) IPv4 LAN addresses on this machine.
 * Filters out WSL, Hyper-V, Docker, VMware, VirtualBox, and other virtual adapters.
 */
function detectPhysicalLanIPs(): { ip: string; name: string }[] {
  const interfaces = os.networkInterfaces();
  const results: { ip: string; name: string }[] = [];

  for (const name of Object.keys(interfaces)) {
    // Filter out virtual network adapters
    if (/wsl|hyper-v|vethernet|vgate|vmnet|virtual|docker|loopback/i.test(name)) {
      continue;
    }

    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        results.push({ ip: net.address, name });
      }
    }
  }

  return results;
}

/**
 * Vite plugin that prints a clear LAN development banner with connection instructions.
 */
function handframeLanBannerPlugin(): Plugin {
  return {
    name: 'handframe-lan-banner',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const address = server.httpServer?.address();
        const port = typeof address === 'object' && address ? address.port : 5173;
        const lanIps = detectPhysicalLanIPs();
        const primaryLan = lanIps[0]?.ip || '<LAN-IP>';

        console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
        console.log('║           HANDFRAME — TRUSTED LAN HTTPS DEV SERVER               ║');
        console.log('╠═══════════════════════════════════════════════════════════════════╣');
        console.log(`║                                                                   ║`);
        console.log(`║  Local:   https://localhost:${port}/                              ║`);
        console.log(`║  LAN:     https://${primaryLan}:${port}/`.padEnd(68) + '║');
        console.log(`║                                                                   ║`);

        if (lanIps.length > 1) {
          console.log('║  Other interfaces:                                                ║');
          lanIps.slice(1).forEach((item) => {
            const line = `║    ${item.name}: https://${item.ip}:${port}/`;
            console.log(line.padEnd(68) + '║');
          });
          console.log(`║                                                                   ║`);
        }

        console.log('╠═══════════════════════════════════════════════════════════════════╣');
        console.log('║  PHONE / OTHER DEVICE SETUP:                                     ║');
        console.log('║                                                                   ║');
        console.log('║  1. Connect phone to the SAME Wi-Fi as this laptop                ║');
        console.log(`║  2. Open https://${primaryLan}:${port}/`.padEnd(68) + '║');
        console.log('║  3. First time: Install the Root CA certificate on the phone      ║');
        console.log('║     (see MOBILE_HTTPS_SETUP.md for step-by-step instructions)     ║');
        console.log('║  4. Tap "Start HandFrame" to grant camera access                  ║');
        console.log('║                                                                   ║');
        console.log('║  Camera:  HTTPS secure-context enabled ✓                         ║');
        console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
      });
    },
  };
}

// Detect LAN IPs at config-load time so mkcert generates certificates with the right SANs
const lanIps = detectPhysicalLanIPs();
const certHosts = [
  'localhost',
  '127.0.0.1',
  '::1',
  ...lanIps.map((entry) => entry.ip),
];

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    mkcert({
      hosts: certHosts,
      // Set force: true temporarily if you need to regenerate after IP changes
      // force: true,
    }),
    handframeLanBannerPlugin(),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    // mkcert plugin handles the HTTPS certificate options automatically
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-vision'],
  },
});
