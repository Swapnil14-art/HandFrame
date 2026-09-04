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

        // Detect non-internal physical IPv4 LAN interfaces (filtering out virtual adapters)
        const interfaces = os.networkInterfaces();
        const physicalLanIps: { ip: string; name: string }[] = [];

        for (const name of Object.keys(interfaces)) {
          const lowerName = name.toLowerCase();
          // Filter out WSL, Hyper-V, Docker, VMware, VirtualBox, and virtual gateway adapters
          if (
            /wsl|hyper-v|vethernet|vgate|vmnet|virtual|docker|loopback/i.test(lowerName)
          ) {
            continue;
          }

          for (const net of interfaces[name] || []) {
            if (net.family === 'IPv4' && !net.internal) {
              physicalLanIps.push({ ip: net.address, name });
            }
          }
        }

        const primaryLan = physicalLanIps[0]?.ip || '10.x.x.x';

        console.log('\n===================================================================');
        console.log('                 HANDFRAME LAN DEV SERVER RUNNING                  ');
        console.log('===================================================================');
        console.log(`\n  ➜ Local Laptop: https://localhost:${port}/`);
        console.log(`  ➜ Mobile LAN:   https://${primaryLan}:${port}/`);

        if (physicalLanIps.length > 1) {
          console.log('\n  Other Physical Interfaces:');
          physicalLanIps.slice(1).forEach((item) => {
            console.log(`  ➜ ${item.name}: https://${item.ip}:${port}/`);
          });
        }

        console.log('\n===================================================================');
        console.log('  MOBILE CONNECTIVITY INSTRUCTIONS (PHONE):');
        console.log('  1. Connect phone to the SAME Wi-Fi network as this laptop.');
        console.log(`  2. Open https://${primaryLan}:${port}/ on Safari (iOS) or Chrome (Android).`);
        console.log('  3. If browser shows SSL warning: Tap "Advanced" -> "Proceed to site".');
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
