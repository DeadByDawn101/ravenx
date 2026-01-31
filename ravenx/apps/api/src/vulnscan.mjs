/**
 * RavenOS Agent/Skill vulnerability scanner (MVP static analysis).
 * - Scans AgentPack zip contents (manifest, agents, skills, plugin manifests)
 * - Flags risky permissions and suspicious patterns (secrets, exec, curl|bash, credential prompts)
 *
 * This is NOT a guarantee of safety; it's a guardrail and triage tool.
 */

const SECRET_PATTERNS = [
  { id: 'secret.aws_key', re: /AKIA[0-9A-Z]{16}/g, severity: 'high', desc: 'Possible AWS access key' },
  { id: 'secret.private_key', re: /-----BEGIN (?:RSA|EC|OPENSSH) PRIVATE KEY-----/g, severity: 'critical', desc: 'Private key material' },
  { id: 'secret.generic_token', re: /(api[_-]?key|secret|token)\s*[:=]\s*['\"][A-Za-z0-9_\-]{16,}['\"]/gi, severity: 'high', desc: 'Hardcoded token-like string' },
];

const EXEC_PATTERNS = [
  { id: 'exec.curl_pipe_sh', re: /curl\s+[^\n|]+\|\s*(sh|bash)/gi, severity: 'high', desc: 'curl | sh pattern' },
  { id: 'exec.wget_pipe_sh', re: /wget\s+[^\n|]+\|\s*(sh|bash)/gi, severity: 'high', desc: 'wget | sh pattern' },
  { id: 'exec.rm_rf', re: /rm\s+-rf\s+\//g, severity: 'critical', desc: 'Potential destructive rm -rf /' },
  { id: 'exec.sudo', re: /\bsudo\b/g, severity: 'medium', desc: 'Uses sudo' },
];

const PHISH_PATTERNS = [
  { id: 'phish.password_prompt', re: /(enter|provide).*(password|private key|seed phrase)/gi, severity: 'high', desc: 'Prompts for sensitive secrets' },
];

function hashText(s) {
  // stable fingerprint for a finding instance
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

export function scanText(text, filePath) {
  const findings = [];

  for (const p of SECRET_PATTERNS) {
    const m = text.match(p.re);
    if (m) findings.push({
      id: p.id,
      severity: p.severity,
      file: filePath,
      desc: p.desc,
      evidence: m.slice(0, 2).join(' | '),
      fingerprint: hashText(p.id + filePath + m[0]),
    });
  }

  for (const p of EXEC_PATTERNS) {
    const m = text.match(p.re);
    if (m) findings.push({
      id: p.id,
      severity: p.severity,
      file: filePath,
      desc: p.desc,
      evidence: m.slice(0, 2).join(' | '),
      fingerprint: hashText(p.id + filePath + m[0]),
    });
  }

  for (const p of PHISH_PATTERNS) {
    const m = text.match(p.re);
    if (m) findings.push({
      id: p.id,
      severity: p.severity,
      file: filePath,
      desc: p.desc,
      evidence: m.slice(0, 2).join(' | '),
      fingerprint: hashText(p.id + filePath + m[0]),
    });
  }

  return findings;
}

export function scoreFindings(findings) {
  const weight = { low: 1, medium: 3, high: 7, critical: 12 };
  let score = 0;
  for (const f of findings) score += weight[f.severity] || 1;
  return score;
}

export function summarizeRisk(score) {
  if (score >= 20) return 'critical';
  if (score >= 10) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

export function scanPack({ manifest, files }) {
  // files: [{ path, text? }]
  const findings = [];
  const perms = manifest?.permissions || {};

  // Permission-based findings
  if (perms.exec) findings.push({
    id: 'perm.exec',
    severity: 'high',
    file: 'manifest.json',
    desc: 'Pack requests exec permission',
    evidence: 'permissions.exec=true',
    fingerprint: hashText('perm.exec'),
  });
  if (perms.filesystem) findings.push({
    id: 'perm.filesystem',
    severity: 'medium',
    file: 'manifest.json',
    desc: 'Pack requests filesystem access',
    evidence: 'permissions.filesystem=true',
    fingerprint: hashText('perm.filesystem'),
  });
  if (perms.network) findings.push({
    id: 'perm.network',
    severity: 'low',
    file: 'manifest.json',
    desc: 'Pack requests network access',
    evidence: 'permissions.network=true',
    fingerprint: hashText('perm.network'),
  });

  // Content scanning
  for (const f of files) {
    if (!f.text) continue;
    const lower = f.path.toLowerCase();
    // Only scan plausible text files (md, json, js, ts, yaml)
    if (!/(\.md|\.json|\.js|\.mjs|\.ts|\.yaml|\.yml|\.txt)$/.test(lower)) continue;
    findings.push(...scanText(f.text, f.path));
  }

  // De-dupe by fingerprint
  const seen = new Set();
  const uniq = [];
  for (const f of findings) {
    if (seen.has(f.fingerprint)) continue;
    seen.add(f.fingerprint);
    uniq.push(f);
  }
  const score = scoreFindings(uniq);
  return { findings: uniq, score, risk: summarizeRisk(score) };
}
