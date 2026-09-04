import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import os from 'os';

function handframeLanBannerPlugin(): Plugin {
  return {
    name: 'handframe-lan-banner',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const address = server.httpServer?.address();
        const port = typeof address === 'object' && address ? address.port : 5173;

        // Detect non-internal IPv4 LAN interfaces
        const interfaces = os.networkInterfaces();
        const lanIps: string[] = [];

        for (const name of Object.keys(interfaces)) {
          for (const net of interfaces[name] || []) {
            if (net.family === 'IPv4' && !net.internal) {
              lanIps.push(net.address);
            }
          }
        }

        // Prioritize Wi-Fi or local LAN subnet (e.g. 192.168.x.x or 10.x.x.x)
        const primaryLan =
          lanIps.find((ip) => ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.')) ||
          lanIps[0] ||
          '192.168.x.x';

        console.log('\n===================================================================');
        console.log('                 HANDFRAME LAN DEV SERVER RUNNING                  ');
        console.log('===================================================================');
        console.log(`\n  ➜ Local Laptop: https://localhost:${port}/`);
        console.log(`  ➜ Mobile LAN:   https://${primaryLan}:${port}/`);
        console.log('\n===================================================================');
        console.log('  MOBILE TESTING INSTRUCTIONS (PHONE):');
        console.log('  1. Connect phone to the SAME Wi-Fi network as this laptop.');
        console.log(`  2. Open https://${primaryLan}:${port}/ on Safari (iOS) or Chrome (Android).`);
        console.log('  3. Bypass local SSL warning ("Advanced -> Proceed to site").');
        console.log('  4. Tap "Start HandFrame" to grant camera access.');
        console.log('===================================================================\n');
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl(),
    handframeLanBannerPlugin(),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: true,
    strictPort: false,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    https: true,
  },
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-vision'],
  },
});
