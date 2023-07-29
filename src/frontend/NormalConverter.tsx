import React from 'react';
import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import { LinearEncoding, NoToneMapping, Texture, TextureLoader } from 'three';
import { FileDropZone } from './FileDropZone';
import { Button } from './Button';

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

const colorCorrection = `
  vec3 toDisplay(vec3 linear) { return pow(linear, vec3(1.0 / 2.2)); }
  vec3 toLinear(vec3 display) { return pow(display, vec3(2.2)); }
`;

const toSimsFragmentShader = `
  uniform sampler2D uTexture;
  varying vec2 varyingUv;

  ${colorCorrection}

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

  ${colorCorrection}

  void main() {
    vec4 sourceColor = texture(uTexture, varyingUv).rgba;

    float red = sourceColor.a;
    float green = sourceColor.g;

    float blue = sqrt(1.0 - pow((red * 2.0) - 1.0, 2.0) + pow((green * 2.0) - 1.0, 2.0)) / 2.0 + 0.5;

    vec3 direction = vec3(
      red,
      green,
      blue
    );

    gl_FragColor = vec4(direction, 1.0);
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
  const [mode, setMode] = useState<Mode | null>(null);
  const [texture, setTexture] = useState<Texture>();

  const loadTexture = async (result: ArrayBuffer) => {
    const url = URL.createObjectURL(new Blob([result]));
    const loader = new TextureLoader();
    loader.load(url, (loaderResult) => {
      loaderResult.colorSpace = '';
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

  console.log(texture?.image.width, texture?.image.height);

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

          <label>From Standard Normal to Sims Encoding</label>
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
            <Button onClick={() => { setTexture(undefined); }}>Back</Button>
          </span>

          <div style={{ maxWidth: '400px', maxHeight: '400px', overflow: 'scroll' }}>
            <div
              style={{
                height: texture.image.height,
                width: texture.image.width,
              }}
            >
              <Canvas
                linear
                gl={{
                  alpha: true,
                  premultipliedAlpha: false,
                  toneMapping: NoToneMapping,
                  outputColorSpace: '',
                  toneMappingExposure: 1,
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
                    toneMapped={false}
                  />
                </mesh>
              </Canvas>
            </div>
          </div>
          <label>(Right Click, Save Image As)</label>
        </div>
      )}
    </div>
  )
};
