import React, { useMemo, useState } from 'react';
import { Wizard } from './Wizard';
import { PhotoScan } from './PhotoScan';
import { Marketplace } from './Marketplace';

type Route = 'wizard' | 'market' | 'photo';

export function App() {
  const [route, setRoute] = useState<Route>('wizard');
  const [connected, setConnected] = useState<boolean>(false);

  const nav = useMemo(() => (
    <div style={{display:'flex', gap: 8, padding: 12, borderBottom: '1px solid #222'}}>
      <button onClick={() => setRoute('wizard')}>Setup</button>
      <button onClick={() => setRoute('market')}>Marketplace</button>
      <button onClick={() => setRoute('photo')}>Photo Scanner</button>
      <div style={{marginLeft:'auto', opacity: 0.8}}>
        Engine: {connected ? 'connected' : 'not connected'}
      </div>
    </div>
  ), [connected]);

  return (
    <div style={{fontFamily:'ui-sans-serif, system-ui', color:'#eee', background:'#0b0b10', minHeight:'100vh'}}>
      {nav}
      <div style={{maxWidth: 980, margin: '0 auto', padding: 16}}>
        {route === 'wizard' && <Wizard onConnected={() => setConnected(true)} onFinish={() => setRoute('market')} />}
        {route === 'market' && <Marketplace />}
        {route === 'photo' && <PhotoScan />}
      </div>
    </div>
  );
}
