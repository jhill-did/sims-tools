import { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import React from 'react';
import { NormalConverter } from './NormalConverter';
import { ModelViewer } from './ModelViewer';
import { Tooltip } from './Tooltip';
import { Routes, Route } from 'react-router';
import { HashRouter, Link } from 'react-router-dom';

type Mode = 'normal-converter' | 'model-viewer';

const App = () => {
  return (
    <HashRouter>
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
            <Link to="/" className="app-icon-button">
              <img src="3d-rotate.svg" style={{ filter: 'invert(0.8)' }} />
            </Link>
          </Tooltip>
          
          <Tooltip text="Normal Converter">
            <Link to="/normal-converter" className="app-icon-button">
              <img src="arrow-up-bar.svg" style={{ filter: 'invert(0.8)' }} />
            </Link>
          </Tooltip>
        </div>

        <div style={{ display: 'flex', flexGrow: 1, justifyContent: 'center' }}>
            <Routes>
              <Route path="/" Component={ModelViewer} />
              <Route path="/normal-converter" Component={NormalConverter} />
            </Routes>
        </div>
      </div>
    </HashRouter >
  );
};

const root = createRoot(document.getElementById('app-root'));
root.render(<App />);
