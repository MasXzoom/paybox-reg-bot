'use strict';

const fs = require('fs');
const path = require('path');

function randomEmail(domain = 'mailinator.com') {
  const prefixes = ['test', 'user', 'agent', 'bot', 'dev', 'sec', 'admin', 'pay'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
  return `${prefix}${suffix}@${domain}`;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function decodeJWT(token) {
  try {
    const [header, payload] = token.split('.');
    return {
      header: JSON.parse(Buffer.from(header + '==', 'base64url').toString()),
      payload: JSON.parse(Buffer.from(payload + '==', 'base64url').toString()),
    };
  } catch { return null; }
}

function log(level, msg, data) {
  const ts = new Date().toISOString().split('T')[1].split('.')[0];
  const tag = level === 'err' ? 'x' : level === 'ok' ? '+' : '>';
  console.log(`[${ts}] ${tag} ${msg}`);
  if (data) console.log(`    ${JSON.stringify(data).slice(0, 200)}`);
}

function saveToken(outputDir, result) {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.appendFileSync(path.join(outputDir, 'tokens.jsonl'), JSON.stringify({
    email: result.email,
    access_token: result.token,
    user_id: result.userId,
    expires: result.expiresAt,
    created: new Date().toISOString(),
  }) + '\n');
}

function saveStats(outputDir, stats) {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'stats.json'), JSON.stringify(stats, null, 2));
}

module.exports = { randomEmail, sleep, decodeJWT, log, saveToken, saveStats };
