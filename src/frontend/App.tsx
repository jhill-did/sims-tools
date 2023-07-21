import { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import React from 'react';
import { NormalConverter } from './NormalConverter';
import { ModelViewer } from './ModelViewer';
import { Tooltip } from './Tooltip';

type Mode = 'normal-converter' | 'model-viewer';

const App = () => {
  const [mode, setMode] = useState<Mode>('model-viewer');

  return (
    <div
      style={{
        flexDirection: 'row',
        position: 'absolute',
        display: 'flex',
        boxSizing: 'border-box',
        width: '100%',
        height: '100%',
        flexWrap: 'nowrap',
        gap: '16px',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          boxSizing: 'border-box',
          padding: '6px',
          flexDirection: 'column',
          backgroundColor: '#222',
          height: '100%',
          width: '36px',
          gap: '6px',
        }}
      >
        <Tooltip text="Model Viewer">
          <button className="app-icon-button" onClick={() => { setMode('model-viewer'); }}>
            <img src="/3d-rotate.svg" style={{ filter: 'invert(0.8)' }} />
          </button>
        </Tooltip>
        
        <Tooltip text="Normal Converter">
          <button className="app-icon-button" onClick={() => { setMode('normal-converter'); }}>
            <img src="/arrow-up-bar.svg" style={{ filter: 'invert(0.8)' }} />
          </button>
        </Tooltip>
      </div>

      <div style={{ display: 'flex', flexGrow: 1, justifyContent: 'center' }}>
        {mode === 'model-viewer' && <ModelViewer />}
        {mode === 'normal-converter' && <NormalConverter />}
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('app-root'));
root.render(<App />);

console.log('rendering');