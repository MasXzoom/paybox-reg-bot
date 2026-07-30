'use strict';

const fs = require('fs');
const path = require('path');
const { PayboxBot } = require('./src/bot');

// Load config
const configPath = path.join(__dirname, 'config/settings.json');
if (!fs.existsSync(configPath)) {
  console.error('Config not found. Copy config/settings.example.json to config/settings.json and fill in your keys.');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const args = process.argv.slice(2);
const count = parseInt(args.find(a => a.match(/^\d+$/))) || 1;

let targetName = config.defaultTarget || 'staging';
if (args.includes('--prod') || args.includes('-p')) targetName = 'prod';
if (args.includes('--staging') || args.includes('-s')) targetName = 'staging';

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Paybox Account Registration Automation
Usage: node index.js [count] [target]

Options:
  [count]        Number of accounts (default: 1)
  -s, --staging  Use staging environment (default)
  -p, --prod     Use production environment
  --list         List configured targets
  -h, --help     Show this help

Setup:
  1. Copy config/settings.example.json to config/settings.json
  2. Fill in your publishableKey and 2captcha key
  3. Run: node index.js 5 --staging
`);
  process.exit(0);
}

if (args.includes('--list')) {
  console.log('Targets:');
  for (const [name, t] of Object.entries(config.targets || {})) {
    console.log(`  ${name}: ${t.tag} | ${t.origin}`);
  }
  process.exit(0);
}

const target = config.targets[targetName];
if (!target) {
  console.error(`Target "${targetName}" not found. Available: ${Object.keys(config.targets).join(', ')}`);
  process.exit(1);
}

// Merge config into target
config.outputDir = path.join(__dirname, config.outputDir, targetName);
target.mailinatorApi = config.mailinatorApi;
target.maxConcurrent = config.maxConcurrent;
target.otpTimeout = config.otpTimeout;
target.otpPollInterval = config.otpPollInterval;
target.retryLimit = config.retryLimit;
target.retryDelay = config.retryDelay;
target.twoCaptchaKey = config.twoCaptchaKey;
target.outputDir = config.outputDir;

console.log(`Paybox Registration Bot | ${target.tag} | ${target.origin} | Count: ${count}`);
new PayboxBot(target).run(count).catch(e => { console.error('Fatal:', e.message); process.exit(1); });
