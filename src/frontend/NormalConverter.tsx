import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { useFileUpload } from './useFileUpload';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import { Texture, TextureLoader, NoColorSpace, LinearSRGBColorSpace, NoToneMapping } from 'three';
import { FileDropZone } from './FileDropZone';

const vertexShader = `
  varying vec2 varyingUv;

  void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);

    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    varyingUv = uv;

    gl_Position = projectedPosition;
  }
`;

const toSimsFragmentShader = `
  uniform sampler2D uTexture;
  varying vec2 varyingUv;

  void main() {
    vec3 sourceColor = texture(uTexture, varyingUv).xyz;
    vec4 swizzled = vec4(
      sourceColor.g,
      sourceColor.g,
      sourceColor.g,
      sourceColor.r
    );

    gl_FragColor = swizzled;
  }
`;

const fromSimsFragmentShader = `
  uniform sampler2D uTexture;
  varying vec2 varyingUv;

  void main() {
    vec4 sourceColor = texture(uTexture, varyingUv).rgba;
    vec3 direction = vec3(
      sourceColor.a,
      sourceColor.g,
      1.0
    );

    vec3 normalized = normalize(direction);

    gl_FragColor = vec4(normalized, 1.0);
  }
`;

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

type Mode = 'from-sims' | 'to-sims';

export const NormalConverter = () => {
  const [normalMap, setNormalMap] = useState<HTMLImageElement>();
  const [mode, setMode] = useState<Mode | null>(null);
  const [texture, setTexture] = useState<Texture>();

  const loadTexture = async (result: ArrayBuffer) => {
    const image = await loadImage(result);
    // setNormalMap(image);
    const url = URL.createObjectURL(new Blob([result]));
    const loader = new TextureLoader();
    loader.load(url, (loaderResult) => {
      // Normals are non-color data.
      // loaderResult.colorSpace = NoColorSpace;
      setTexture(loaderResult);
    });
  };

  const onUploadStandardNormal = (file: ArrayBuffer) => {
    setMode('to-sims');
    loadTexture(file);
  };

  const onUploadSimsNormal = (file: ArrayBuffer) => {
    setMode('from-sims');
    loadTexture(file);
  };

  const fragmentShader = mode === 'from-sims'
    ? fromSimsFragmentShader
    : toSimsFragmentShader;

  const imageStyle = {
    borderRadius: '16px',
    filter: 'drop-shadow(rgba(17, 17, 17, 0.25) 8px 8px 7px)',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#222',
        padding: '32px',
      }}
    >
      <h3>Sims Normal Converter</h3>

      {!texture && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label>From Sims Encoding to Standard Normal</label>
          <FileDropZone onUpload={onUploadSimsNormal}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <img src="sims-normal.png" width="128" height="128" style={imageStyle} />
              <img src="arrow-right.svg" />
              <img src="standard-normal.png" width="128" height="128" style={imageStyle} />
            </div>
          </FileDropZone>

          <label>To Sims Encoding from Standard Normal</label>
          <FileDropZone onUpload={onUploadStandardNormal}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <img src="standard-normal.png" width="128" height="128" style={imageStyle} />
              <img src="arrow-right.svg" />
              <img src="sims-normal.png" width="128" height="128" style={imageStyle} />
            </div>
          </FileDropZone>
        </div>
      )}

      {texture && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ width: '100%' }}>
            <button onClick={() => { setTexture(undefined); }}>Back</button>
          </span>

          <div
            style={{
              height: texture.image.width,
              width: texture.image.height,
              maxHeight: '400px',
              maxWidth: '400px',
            }}
          >
            <Canvas
              linear
              flat
              gl={{
                alpha: true,
                premultipliedAlpha: false,
              }}
            >
              <OrthographicCamera
                makeDefault
                zoom={1}
                top={1}
                bottom={-1}
                left={1}
                right={-1}
              />
              <mesh rotation={[Math.PI, 0, Math.PI]} position={[0, 0, -1]}>
                <planeGeometry args={[2, 2]} />
                <shaderMaterial
                  vertexShader={vertexShader}
                  fragmentShader={fragmentShader}
                  uniforms={{ uTexture: { value: texture }}}
                />
              </mesh>
            </Canvas>
          </div>

          <label>(Right Click, Save Image As)</label>
        </div>
      )}
    </div>
  )
};
