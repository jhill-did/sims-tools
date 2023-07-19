import { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { readPackageMlods } from '../loader/main';
import React from 'react';
import { makeObj, makeObjFromModel } from '../loader/obj';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera } from '@react-three/drei';
import { NormalConverter } from './NormalConverter';
import { useFileUpload } from './useFileUpload';

type Mlods = ReturnType<typeof readPackageMlods>;
type Mlod = Mlods[0];

type Mesh = Mlod['meshes'][0];

type ViewerProps = {
  meshes: Mesh[] | undefined;
  onDownload: () => void;
  downloadName: string;
  onChangeDownloadName: (x: string) => void;
};

const Viewer = ({
  meshes,
  onDownload,
  downloadName,
  onChangeDownloadName,
}: ViewerProps) => {
  if (!meshes) {
    return null;
  }

  const viewerMeshes = meshes
    .map((mesh, index) => {
      const { geometry } = mesh;

      const positions = geometry.vertices.flatMap(v => v.position);
      const positionsData = positions && new Float32Array(positions);

      const normals = geometry.vertices.flatMap(v => v.normal);
      const normalsData = normals && new Float32Array(normals);

      const indices = geometry.indices;
      const indexData = indices && new Uint32Array(indices);

      return (
        <mesh key={index}>
          <bufferGeometry attach="geometry">
            <bufferAttribute
              attach="index"
              array={indexData}
              itemSize={1}
              count={(indexData?.length ?? 0)}
            />
            <bufferAttribute
              attach="attributes-position"
              array={positionsData}
              itemSize={3}
              count={(positionsData?.length ?? 0) / 3}
            ></bufferAttribute>
            <bufferAttribute
              attach="attributes-normal"
              array={normalsData}
              itemSize={3}
              count={(normalsData?.length ?? 0) / 3}
            />
          </bufferGeometry>
          <meshStandardMaterial attach="material" color="white" />
        </mesh>
      );
    });

  return (
    <div
      style={{
        backgroundColor: '#222',
        width: '400px',
        height: '400px',
        marginLeft: '16px',
        padding: '8px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'row', gap: '4px' }}>
        <button onClick={onDownload}>Download</button>
        <input
          type="text"
          value={downloadName}
          onChange={(e) => { onChangeDownloadName(e.target.value); }}
        ></input>
      </div>
      
      <Canvas>
        <PerspectiveCamera makeDefault position={[4, 4, 4]} />
        <OrbitControls />
        <Grid args={[5, 5]} />
        <ambientLight color={[0.25, 0.25, 0.25]} />
        <pointLight position={[10, 10, 10]} />

        {viewerMeshes}
      </Canvas>
    </div>
  );
};

const downloadMlod = (fileName: string, mlod: Mlod) => {
  const model = { meshes: mlod.meshes.map(mesh => mesh.geometry) };
  const obj = makeObjFromModel(model);

  const anchor = window.document.createElement('a');
  const data = new Blob([obj], { type: 'text/plain' })
  anchor.href = window.URL.createObjectURL(data);
  anchor.download = fileName;

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};

const ModelViewer = () => {
  const [mlods, setMlods] = useState<Mlods | null>([]);
  const [viewerTarget, setViewerTarget] = useState<number | null>(null);
  const [downloadName, setDownloadName] = useState('model.obj');

  const onUpload = (result: ArrayBuffer) => {
    const loadedMlods = readPackageMlods(result);
    setMlods(loadedMlods);

    // Select our first mlod if it exists.
    const target = loadedMlods.length > 0 ? 0 : null;
    setViewerTarget(target);
  };

  const { onDrop, onOpen } = useFileUpload(onUpload);

  const ughStyle: React.CSSProperties = {
    textAlign: 'center',
  };

  const mlodElements = (mlods ?? [])
    .map((mlod, index) => (
      <div
        key={index}
        role="button"
        tabIndex={index}
        onClick={() => { setViewerTarget(index); }}
        style={{
          display: 'flex',
          justifyContent: 'center',
          flexDirection: 'column',
          margin: '8px',
          border: '1px solid #777',
          padding: '8px',
          cursor: 'pointer',
          backgroundColor: viewerTarget === index ? '#444' : undefined,
        }}
      >
        <span style={ughStyle}>Tag: {mlod.mlodHeader.tag}</span>
        <span style={ughStyle}>Version: {mlod.mlodHeader.version}</span>
        <span style={ughStyle}>Mesh Count:{mlod.mlodHeader.meshCount}</span>
      </div>
    ));

  const viewerMeshes = mlods?.[viewerTarget ?? 0]?.meshes;

  return (
    <div style={{ display: 'flex' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#222',
          padding: '32px',
          minWidth: '450px',
        }}
      >
        <h3>Sims 3 Model Viewer</h3>
        <input
          type="file"
          onDrop={onDrop}
          onChange={onOpen}
          style={{ marginBottom: '16px' }}
        ></input>

        {mlodElements}
      </div>

      <Viewer
        meshes={viewerMeshes}
        onDownload={() => {
          if (mlods && viewerTarget !== null) {
            downloadMlod(downloadName, mlods[viewerTarget]);
          }
        }}
        downloadName={downloadName}
        onChangeDownloadName={setDownloadName}
      />
    </div>
  );
};

const App = () => {
  return (
    <div
      style={{
        flexDirection: 'column',
        position: 'absolute',
        display: 'flex',
        boxSizing: 'border-box',
        width: '100%',
        height: '100%',
        padding: '32px',
        alignContent: 'center',
        flexWrap: 'nowrap',
        gap: '16px',
        alignItems: 'center',
      }}
    >
      <ModelViewer />
      <NormalConverter />
    </div>
  );
};

const root = createRoot(document.getElementById('app-root'));
root.render(<App />);

console.log('rendering');