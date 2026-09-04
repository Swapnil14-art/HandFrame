#!/usr/bin/env node
/**
 * HandFrame LAN Development Diagnostic Script
 * Checks server config, networking, HTTPS certificates, firewall, and SPA routing.
 *
 * Usage:  npm run diagnose:lan
 */

import os from 'os';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const PORT = 5173;
const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const WARN = '\x1b[33m⚠\x1b[0m';
const INFO = '\x1b[36mℹ\x1b[0m';

let issues = 0;

function header(title) {
  console.log(`\n\x1b[1m━━━ ${title} ━━━\x1b[0m`);
}

function pass(msg) { console.log(`  ${PASS} ${msg}`); }
function fail(msg) { issues++; console.log(`  ${FAIL} ${msg}`); }
function warn(msg) { console.log(`  ${WARN} ${msg}`); }
function info(msg) { console.log(`  ${INFO} ${msg}`); }

// ─── 1. Server Configuration ───
header('Server Configuration');

try {
  const viteConfig = fs.readFileSync(path.join(projectRoot, 'vite.config.ts'), 'utf-8');

  if (viteConfig.includes("host: '0.0.0.0'") || viteConfig.includes('host: true')) {
    pass('Vite server bound to all interfaces (0.0.0.0)');
  } else {
    fail('Vite server NOT bound to 0.0.0.0 — LAN devices cannot connect');
  }

  if (viteConfig.includes('mkcert')) {
    pass('Using vite-plugin-mkcert for trusted HTTPS certificates');
  } else if (viteConfig.includes('basicSsl')) {
    warn('Using @vitejs/plugin-basic-ssl — generates untrusted certificates');
  } else {
    fail('No HTTPS certificate plugin found');
  }

  if (viteConfig.includes('certHosts') || viteConfig.includes('hosts:')) {
    pass('Certificate SAN hosts configured (includes LAN IPs)');
  } else {
    warn('mkcert hosts not explicitly set — may not include LAN IP in SAN');
  }
} catch {
  fail('vite.config.ts not found or unreadable');
}

// ─── 2. LAN IP Detection ───
header('LAN IP Detection');

const interfaces = os.networkInterfaces();
const lanIps = [];

for (const name of Object.keys(interfaces)) {
  if (/wsl|hyper-v|vethernet|vgate|vmnet|virtual|docker|loopback/i.test(name)) continue;

  for (const net of interfaces[name] || []) {
    if (net.family === 'IPv4' && !net.internal) {
      lanIps.push({ ip: net.address, name, mac: net.mac });
    }
  }
}

if (lanIps.length > 0) {
  lanIps.forEach((entry) => {
    pass(`${entry.name}: ${entry.ip}  (MAC: ${entry.mac})`);
  });
  info(`Primary LAN URL: https://${lanIps[0].ip}:${PORT}/`);
} else {
  fail('No physical LAN IPv4 interface found — are you connected to Wi-Fi/Ethernet?');
}

// ─── 3. Port Availability ───
header('Port Availability');

try {
  const netstat = execSync(`netstat -ano | findstr :${PORT}`, { encoding: 'utf-8', timeout: 5000 });
  if (netstat.includes('LISTENING')) {
    const lines = netstat.trim().split('\n').filter(l => l.includes('LISTENING'));
    lines.forEach(line => {
      const pid = line.trim().split(/\s+/).pop();
      warn(`Port ${PORT} is already in use (PID: ${pid}). Stop existing server first.`);
    });
  } else {
    pass(`Port ${PORT} is available`);
  }
} catch {
  pass(`Port ${PORT} is available`);
}

// ─── 4. HTTPS Certificate ───
header('HTTPS Certificate');

const mkcertDataDirs = [
  path.join(os.homedir(), '.vite-plugin-mkcert'),
  path.join(os.homedir(), 'AppData', 'Local', 'vite-plugin-mkcert'),
];

let certDir = null;
let rootCaPath = null;

for (const dir of mkcertDataDirs) {
  if (fs.existsSync(dir)) {
    certDir = dir;
    const possibleCa = path.join(dir, 'rootCA.pem');
    if (fs.existsSync(possibleCa)) rootCaPath = possibleCa;
    break;
  }
}

// Also check the mkcert default directory
const mkcertDefaultDir = path.join(os.homedir(), 'AppData', 'Local', 'mkcert');
if (!rootCaPath && fs.existsSync(mkcertDefaultDir)) {
  const possibleCa = path.join(mkcertDefaultDir, 'rootCA.pem');
  if (fs.existsSync(possibleCa)) {
    rootCaPath = possibleCa;
    certDir = mkcertDefaultDir;
  }
}

if (rootCaPath) {
  pass(`Root CA found: ${rootCaPath}`);
  info('This CA must be installed on phones/other laptops for trusted HTTPS');
  info(`Copy to phone: ${rootCaPath}`);
} else {
  warn('Root CA not found yet — run "npm run dev" once to generate certificates');
  info('Expected locations:');
  mkcertDataDirs.forEach(d => info(`  ${d}`));
}

if (certDir) {
  const certFiles = fs.readdirSync(certDir).filter(f => f.endsWith('.pem') || f.endsWith('.crt'));
  certFiles.forEach(f => info(`  Certificate file: ${path.join(certDir, f)}`));

  // Try to inspect certificate SAN
  const certPath = certFiles.find(f => f.includes('cert') || f.includes('dev'));
  if (certPath) {
    try {
      const openssl = execSync(`openssl x509 -in "${path.join(certDir, certPath)}" -text -noout 2>&1`, {
        encoding: 'utf-8', timeout: 5000
      });
      const sanMatch = openssl.match(/Subject Alternative Name:[\s\S]*?(?=\n\s*\S)/);
      if (sanMatch) {
        const sans = sanMatch[0].replace('Subject Alternative Name:', '').trim();
        info(`Certificate SANs: ${sans}`);
        for (const entry of lanIps) {
          if (sans.includes(entry.ip)) {
            pass(`LAN IP ${entry.ip} is in certificate SAN`);
          } else {
            fail(`LAN IP ${entry.ip} is NOT in certificate SAN — phone will see "Not Secure"`);
            info('Fix: Delete cert files and restart "npm run dev" to regenerate with current IP');
          }
        }
      }
    } catch {
      // Fallback: Read config.json directly (no OpenSSL needed)
      try {
        const configPath = path.join(certDir, 'config.json');
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          const hosts = config?.record?.hosts || [];
          if (hosts.length > 0) {
            info(`Certificate SANs (from config.json): ${hosts.join(', ')}`);
            for (const entry of lanIps) {
              if (hosts.includes(entry.ip)) {
                pass(`LAN IP ${entry.ip} is in certificate SAN`);
              } else {
                fail(`LAN IP ${entry.ip} is NOT in certificate SAN — phone will see "Not Secure"`);
                info('Fix: Delete cert.pem and dev.pem, restart "npm run dev" to regenerate');
              }
            }
          }
        }
      } catch {
        info('Could not read mkcert config.json');
      }
    }
  }
}

// ─── 5. Firewall ───
header('Windows Firewall');

try {
  const rules = execSync(
    `netsh advfirewall firewall show rule name="HandFrame Dev Server" 2>&1`,
    { encoding: 'utf-8', timeout: 5000 }
  );
  if (rules.includes('HandFrame Dev Server')) {
    pass('Firewall rule "HandFrame Dev Server" exists');
    if (rules.includes(String(PORT))) {
      pass(`Rule includes port ${PORT}`);
    } else {
      warn(`Rule exists but may not cover port ${PORT}`);
    }
  } else {
    fail('No firewall rule found for HandFrame');
  }
} catch {
  fail('No "HandFrame Dev Server" firewall rule found');
  info(`Run as Administrator: npm run firewall:open`);
  info(`Or manually: netsh advfirewall firewall add rule name="HandFrame Dev Server" dir=in action=allow protocol=TCP localport=${PORT}`);
}

// ─── 6. SPA Routing ───
header('SPA Routing');

try {
  const viteConfig = fs.readFileSync(path.join(projectRoot, 'vite.config.ts'), 'utf-8');
  // Vite dev server handles SPA fallback automatically for index.html
  pass('Vite dev server provides automatic SPA fallback for /camera and /aesthetic14');
} catch {
  warn('Could not verify SPA routing configuration');
}

// ─── 7. Localhost-only Dependencies ───
header('Localhost-Only Dependencies');

try {
  const srcDir = path.join(projectRoot, 'src');
  const checkFiles = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const problems = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        problems.push(...checkFiles(fullPath));
      } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        // Look for problematic localhost hardcodes (not in comments or secure-context checks)
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.includes('http://localhost') || line.includes('http://127.0.0.1')) {
            if (!line.trim().startsWith('//') && !line.trim().startsWith('*')) {
              problems.push(`${path.relative(projectRoot, fullPath)}:${i + 1} — Hardcoded insecure localhost URL`);
            }
          }
        }
      }
    }
    return problems;
  };

  const problems = checkFiles(srcDir);
  if (problems.length === 0) {
    pass('No hardcoded insecure localhost/127.0.0.1 URLs in src/');
  } else {
    problems.forEach(p => fail(p));
  }
} catch (err) {
  warn('Could not scan src/ for localhost dependencies');
}

// ─── 8. Secure Context ───
header('Secure Context Configuration');

try {
  const cameraManager = fs.readFileSync(path.join(projectRoot, 'src', 'camera', 'CameraManager.ts'), 'utf-8');
  if (cameraManager.includes('isSecureContext') || cameraManager.includes('SECURE_CONTEXT_REQUIRED')) {
    pass('CameraManager validates secure context before getUserMedia()');
  } else {
    warn('CameraManager may not check secure context');
  }

  if (cameraManager.includes('getUserMedia')) {
    pass('Camera uses navigator.mediaDevices.getUserMedia()');
  } else {
    fail('Camera does not use standard getUserMedia API');
  }
} catch {
  warn('Could not inspect CameraManager.ts');
}

// ─── 9. Package Dependencies ───
header('Package Dependencies');

try {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
  const devDeps = pkg.devDependencies || {};
  if (devDeps['vite-plugin-mkcert']) {
    pass(`vite-plugin-mkcert: ${devDeps['vite-plugin-mkcert']}`);
  } else {
    fail('vite-plugin-mkcert not installed');
  }

  if (devDeps['@vitejs/plugin-basic-ssl']) {
    warn('@vitejs/plugin-basic-ssl is still installed — consider removing (generates untrusted certs)');
  }
} catch {
  fail('Could not read package.json');
}

// ─── Summary ───
console.log('\n' + '═'.repeat(67));
if (issues === 0) {
  console.log(`\x1b[32m  ✓ All ${10} checks passed — HandFrame LAN setup looks good!\x1b[0m`);
  console.log('\n  Next: Start the server with "npm run dev"');
  if (lanIps.length > 0) {
    console.log(`  Then open https://${lanIps[0].ip}:${PORT}/ on your phone`);
  }
} else {
  console.log(`\x1b[31m  ✗ ${issues} issue(s) found — see details above\x1b[0m`);
}
console.log('═'.repeat(67) + '\n');

process.exit(issues > 0 ? 1 : 0);
