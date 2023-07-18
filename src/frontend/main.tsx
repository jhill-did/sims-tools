import { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { readPackageMlods } from '../loader/main';
import React from 'react';
import { makeObj, makeObjFromModel } from '../loader/obj';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera } from '@react-three/drei';

/*
<div id="drop-zone" style={{
  position: 'fixed',
  boxSizing: 'border-box',
  height: '100%',
  width: '100%',
  padding: '16px',
}}>
  <div style={{
    boxSizing: 'border-box',
    height: '100%',
    width: '100%',
    border: '5px solid blue',
  }}
  ></div>

</div>
*/

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

const uploadFile = async (file: File): Promise<ArrayBuffer> => {
  const reader = new FileReader();

  return new Promise((resolve, reject) => {
    reader.onloadend = () => {
      const result = reader.result;

      if (!result || typeof result === 'string') {
        reject('Couldn\'t read file');
      }

      resolve(result as ArrayBuffer);
    };

    reader.readAsArrayBuffer(file);
  });
};

const useFileUpload = (onUpload: (result: ArrayBuffer) => void) => {
  const onDrop = (event: React.DragEvent<HTMLInputElement>) => {
    event.preventDefault();
    console.log(event.dataTransfer.items);
    const item = event.dataTransfer.items[0];

    if (!item) {
      throw 'No file uploaded';
    }

    const file = item.getAsFile();

    if (!file) {
      throw 'Cound\'t read file';
    }

    return uploadFile(file).then(onUpload);
  };

  const onOpen = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    const file = event.target.files?.[0];

    if (!file) {
      throw 'No file uploaded';
    }

    return uploadFile(file).then(onUpload);
  };

  return { onDrop, onOpen };
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

const loadImage = (buffer: ArrayBuffer) => {
  return new Promise<HTMLImageElement>((resolve) => {
    const img = document.createElement('img');
    const url = URL.createObjectURL(new Blob([buffer]));
    img.onload = () => {
      resolve(img);
    };

    img.src = url;
  });
};

const NormalConversion = () => {
  const [normalMap, setNormalMap] = useState<HTMLImageElement>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const convertFromSims = () => {
    const canvas = canvasRef.current;
    if (!canvas ||!normalMap) {
      return;
    }

    const context = canvas.getContext('2d')!;
    context.drawImage(normalMap, 0, 0);

    const { width, height } = canvas;
    const imageData = context.getImageData(0, 0, width, height, { }).data;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = ((y * width) + x) * 4;
        // const red = imageData[offset + 0];
        const green = imageData[offset + 1];
        // const blue = imageData[offset + 2];
        const alpha = imageData[offset + 3];

        // Clear the current pixel
        // context.fillStyle = `rgba(0, 0, 0, 1.0)`;
        // context.fillRect(x, y, 1, 1);

        const normal = [alpha, green, 255];
        const magnitude = Math.sqrt(normal[0] ** 2 + normal[1] ** 2 + normal[2] ** 2);
        const adjustedNormal = normal.map(x => (x / magnitude) * 255);
        const [vx, vy, vz] = adjustedNormal;

        // const [vx, vy, vz] = normal.map(x => x);
        context.fillStyle = `rgba(${vx}, ${vy}, ${vz}, 1.0)`;
        context.fillRect(x, y, 1, 1);
      }
    }
  };

  const convertToSims = () => {

  };

  const onUpload = async (result: ArrayBuffer) => {
    const image = await loadImage(result);
    setNormalMap(image);
  };

  const { onDrop, onOpen } = useFileUpload(onUpload);

  // Attach our normal map image if one exists.
  useEffect(() => {
    if (!normalMap || !imageContainerRef.current) {
      return;
    }

    imageContainerRef.current.innerHTML = '';
    imageContainerRef.current.append(normalMap);

    // Also clear our canvas if it exists.
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext('2d');
      context?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [normalMap]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#222',
        padding: '32px',
        minWidth: '450px',
      }}
    >
      <h3>Sims Normal Converter</h3>
      <input
        type="file"
        onDrop={onDrop}
        onChange={onOpen}
        style={{ marginBottom: '16px' }}
      ></input>

      {normalMap && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div
            style={{ display: 'flex', flexDirection: 'row', gap: '16px' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                ref={imageContainerRef}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  maxWidth: '400px',
                  maxHeight: '400px',
                }}
              />

              <div style={{
                display: 'flex',
                flexDirection: 'row',
                width: '100%',
                justifyContent: 'space-evenly',
              }}>
                <button onClick={convertToSims}>To Sims Format</button>
                <button onClick={convertFromSims}>From Sims Format</button>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                maxWidth: '400px',
                maxHeight: '400px',
              }}
            >
              <canvas
                ref={canvasRef}
                width={normalMap.width}
                height={normalMap.height}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
};

const App = () => {
  return (
    <div
      style={{
        flexDirection: 'column',
        position: 'absolute',
        display: 'flex',
        justifyContent: 'center',
        boxSizing: 'border-box',
        width: '100%',
        height: '100%',
        padding: '32px',
        alignContent: 'center',
        flexWrap: 'wrap',
        gap: '16px',
      }}
    >
      <ModelViewer />
      <NormalConversion />
    </div>
  );
};

const root = createRoot(document.getElementById('app-root'));
root.render(<App />);

console.log('rendering');