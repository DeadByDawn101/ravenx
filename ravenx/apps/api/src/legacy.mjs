/**
 * Legacy import support:
 * - Detects older OpenClaw-style exports (agent.json + skills/*.md without RavenOS manifest)
 * - Converts to a RavenOS AgentPack manifest in memory for preview/install
 */

export function detectLegacyLayout(entries) {
  // entries: list of zip paths
  const hasRavenManifest = entries.includes('manifest.json');
  if (hasRavenManifest) return null;

  const hasAgentJson = entries.some(p => /(^|\/)agent\.json$/i.test(p));
  const hasSkills = entries.some(p => /^skills\/.+\.md$/i.test(p));
  const hasOpenclawPlugin = entries.some(p => /openclaw\.plugin\.json$/i.test(p));

  if (hasAgentJson || hasSkills || hasOpenclawPlugin) {
    return { kind: 'openclaw-legacy' };
  }
  return null;
}

export function convertLegacyToManifest({ entries, agentPaths, skillPaths, toolPaths }) {
  const agents = agentPaths.length ? agentPaths : [];
  const skills = skillPaths.length ? skillPaths : [];
  const tools = toolPaths.length ? toolPaths : [];

  return {
    format: 'ravenos-agentpack@1',
    name: 'Legacy Import',
    version: '0.0.0',
    kind: agents.length ? 'agent-pack' : 'skill-pack',
    publisher: { name: 'Legacy' },
    description: 'Converted from legacy OpenClaw-style export.',
    permissions: { network: true, filesystem: false, exec: false, camera: false },
    contents: { agents, skills, tools, ui: [] }
  };
}
