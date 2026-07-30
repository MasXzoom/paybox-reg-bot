'use strict';

const { pollOTP } = require('./otp');
const { randomEmail, sleep, decodeJWT, log, saveToken, saveStats } = require('./utils');
const { HttpClient } = require('./http');

class PayboxBot {
  constructor(target) {
    this.target = target;
    this.http = new HttpClient(target);
    this.state = { created: 0, failed: 0, rateLimited: 0, tokens: [], start: Date.now() };
  }

  async registerOne(email) {
    const inbox = email.split('@')[0];
    const r = { email, status: 'pending', token: null, userId: null, error: null };
    const t = this.target;

    try {
      // 1. Config check
      const cfg = await this.http.request(`${t.moonxBase}/v0/sdk/apps/public/config?publishableKey=${t.publishableKey}`, { timeout: 10000 });
      if (cfg.status !== 200) throw new Error(`config: ${cfg.status}`);

      // 2. Send OTP
      log('info', `[${email}] Sending OTP...`);
      let begin;
      for (let i = 0; i < t.retryLimit; i++) {
        begin = await this.http.request(`${t.moonxBase}/v0/sdk/wallet/email/begin`, { method: 'POST', body: { email }, timeout: 10000 });
        if (begin.status === 200) break;
        if (begin.status === 429) { this.state.rateLimited++; log('info', `[${email}] Rate limited, retry...`); await sleep(t.retryDelay); continue; }
        if (begin.json() && begin.json().error && begin.json().error.includes('daily')) throw new Error(begin.json().error);
        break;
      }
      if (!begin || begin.status !== 200) throw new Error(`begin: ${begin ? begin.status : 'fail'}`);

      // 3. Poll OTP
      log('info', `[${email}] Polling inbox...`);
      const otp = await pollOTP(this.http, t, inbox);
      if (!otp) throw new Error('OTP timeout');
      log('ok', `[${email}] OTP: ${otp.code} (${otp.age}s ago)`);

      // 4. Verify
      log('info', `[${email}] Verifying...`);
      const verify = await this.http.request(`${t.moonxBase}/v0/sdk/wallet/email/verify`, { method: 'POST', body: { email, code: otp.code }, timeout: 10000 });
      if (verify.status !== 200) throw new Error(`verify: ${verify.status}`);
      const v = verify.json();
      if (!v.access_token) throw new Error('no token');

      r.token = v.access_token;
      r.idToken = v.id_token;
      r.status = 'token_acquired';

      const jwt = decodeJWT(v.access_token);
      if (jwt) { r.userId = jwt.payload.sub; r.expiresAt = new Date(jwt.payload.exp * 1000).toISOString(); }
      log('ok', `[${email}] Token OK uid=${r.userId} exp=${r.expiresAt}`);

      // 5. User profile
      const me = await this.http.request(`${t.moonxBase}/v0/sdk/auth/users/public/me`, { token: v.access_token, timeout: 10000 });
      if (me.status === 200) { r.user = me.json(); r.status = 'complete'; }

      // 6. Passkey status
      await this.http.request(`${t.moonxBase}/v0/sdk/auth/passkey/status`, { method: 'POST', body: {}, token: v.access_token, timeout: 5000 });

      // 7. Google OAuth probe
      const g = await this.http.request(`${t.moonxBase}/v0/sdk/auth/oauth/google/begin?login_redirect_url=${encodeURIComponent(t.origin)}`, { token: v.access_token, timeout: 5000 });
      if (g.status === 200) r.googleOAuth = true;

      // 8. Probe target API
      const pb = await this.http.request(`${t.apiBase}/api/users/me`, { token: v.access_token, timeout: 5000, headers: {} });
      r.payboxStatus = pb.status;

      saveToken(t.outputDir, r);
      this.state.created++;
      this.state.tokens.push({ email, user_id: r.userId, exp: r.expiresAt });
      log('ok', `[${email}] DONE | API: ${pb.status}`);
    } catch (e) {
      r.status = 'failed';
      r.error = e.message;
      this.state.failed++;
      log('err', `[${email}] FAIL: ${e.message}`);
    }
    return r;
  }

  async run(count) {
    log('info', `Creating ${count} accounts, ${this.target.maxConcurrent} concurrent...`);
    const emails = Array.from({ length: count }, () => randomEmail());
    log('info', `Emails: ${emails.join(', ')}`);

    const queue = [...emails];
    const running = new Set();
    const results = [];

    while (queue.length > 0 || running.size > 0) {
      while (running.size < this.target.maxConcurrent && queue.length > 0) {
        const email = queue.shift();
        const p = this.registerOne(email).then(res => { running.delete(p); results.push(res); return res; });
        running.add(p);
      }
      await sleep(500);
    }

    saveStats(this.target.outputDir, {
      target: this.target.tag,
      total: count, created: this.state.created, failed: this.state.failed,
      rate_limited: this.state.rateLimited, runtime_s: Math.round((Date.now() - this.state.start) / 1000),
      tokens: this.state.tokens,
    });

    const s = this.state;
    console.log('');
    console.log('--- SUMMARY ---');
    console.log(`Target: ${this.target.tag} | Total: ${count} | OK: ${s.created} | FAIL: ${s.failed} | Rate: ${s.rateLimited} | Time: ${Math.round((Date.now() - s.start) / 1000)}s`);
    for (const r of results) {
      const tag = r.status === 'complete' || r.status === 'token_acquired' ? '+' : 'x';
      console.log(`  ${tag} ${r.email} -> ${r.userId || r.error}`);
    }
    console.log(`Output: ${this.target.outputDir}/`);
    return results;
  }
}

module.exports = { PayboxBot };
