import React from 'react';

const catalog = [
  { id: 'skill.openclaw-legacy-backup', name: 'OpenClaw Legacy Backup Skill', kind: 'Skill Pack', desc: 'Community skill to export/import agents & skills safely.', action: 'Install' },
  { id: 'security.vuln-scan', name: 'Vuln Scanner (static)', kind: 'Security', desc: 'Automatically scans uploaded packs for risky patterns before install.', action: 'Enabled' },
  { id: 'pack.raven-starter', name: 'Raven Starter Agent', kind: 'Agent Pack', desc: 'Example agent pack structure (placeholder).', action: 'Install' },
  { id: 'skill.photo-scan', name: 'Photo Scanner Skill', kind: 'Skill Pack', desc: 'Adds photo.scan tool guidance + UI panel.', action: 'Install' },
  { id: 'ui.photo-scan', name: 'Photo Scanner UI', kind: 'UI Extension', desc: 'Upload image, scan, skin, export JSON.', action: 'Enable' },
];

export function Marketplace() {
  return (
    <div>
      <h2 style={{fontSize: 22, margin: '8px 0'}}>Marketplace</h2>
      <p style={{opacity:0.8}}>This is a stub catalog. Next step: load a real catalog JSON and wire installs to the engine.</p>
      <div style={{display:'grid', gap: 12}}>
        {catalog.map(item => (
          <div key={item.id} style={{border:'1px solid #222', borderRadius: 12, padding: 12, background:'#0f0f16'}}>
            <div style={{display:'flex', gap: 10, alignItems:'baseline'}}>
              <div style={{fontWeight:800}}>{item.name}</div>
              <div style={{opacity:0.7}}>{item.kind}</div>
            </div>
            <div style={{opacity:0.85, marginTop: 6}}>{item.desc}</div>
            <div style={{marginTop: 10}}>
              <button style={{padding:'8px 10px', borderRadius:10, border:'1px solid #333', background:'#111', color:'#eee'}} disabled>
                {item.action} (TODO)
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
