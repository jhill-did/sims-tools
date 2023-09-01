import React, { useEffect, useMemo, useRef } from 'react';
import { useState } from 'react';
import { FileDropZone } from './FileDropZone';
import { Button } from './Button';
import { Image, Png, makeImageFromBuffer } from 'image-io';

const fullScreenTriangle = Float32Array.from([
  -1.0, -3.0, 0.0, 2.0, // x y u v
  -1.0, 1.0, 0.0, 0.0,
  3.0, 1.0, 2.0, 0.0,
]);

const vertexShader = `#version 300 es
  precision mediump float;
  
  layout(location = 0) in vec2 position;
  layout(location = 1) in vec2 uv;

  out vec2 varyingUv;

  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
    varyingUv = uv;
  }
`;

const colorCorrection = `
  vec3 toDisplay(vec3 linear) { return pow(linear, vec3(1.0 / 2.2)); }
  vec3 toLinear(vec3 display) { return pow(display, vec3(2.2)); }
`;

const toSimsFragmentShader = `#version 300 es
  precision mediump float;

  uniform sampler2D uTexture;
  in vec2 varyingUv;

  ${colorCorrection}

  out vec4 fragColor;

  void main() {
    vec3 sourceColor = texture(uTexture, varyingUv).xyz;
    vec4 swizzled = vec4(
      sourceColor.g,
      sourceColor.g,
      sourceColor.g,
      sourceColor.r
    );

    fragColor = swizzled; // vec4(swizzled.xyz, 1.0);
  }
`;

const fromSimsFragmentShader = `#version 300 es
  precision mediump float;

  uniform sampler2D uTexture;
  in vec2 varyingUv;

  ${colorCorrection}

  out vec4 fragColor;

  void main() {
    vec4 sourceColor = texture(uTexture, varyingUv).rgba;

    float red = sourceColor.a;
    float green = sourceColor.g;

    float redSquare = pow((red * 2.0) - 1.0, 2.0);
    float greenSquare = pow((green * 2.0) - 1.0, 2.0);
    float blueSquare = 1.0 - redSquare + greenSquare;
    float blueSqrt = sqrt(blueSquare);
    // float blue = (blueSqrt + 1.0) / 2.0;
    float debug = red;

    float blue = sqrt(1.0 - pow((red * 2.0) - 1.0, 2.0) + pow((green * 2.0) - 1.0, 2.0)) / 2.0 + 0.5;

    vec3 direction = vec3(
      red,
      green,
      blue
    );

    vec4 outputColor = vec4(vec3(direction), 1.0);
    fragColor = outputColor;
  }
`;

type Gl = WebGL2RenderingContext;
const makeShader = (gl: Gl, source: string, type: 'vertex' | 'fragment') => {
  const shaderType = type === 'vertex' ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER;
  const shader = gl.createShader(shaderType)!;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!success) {
    const error = gl.getShaderInfoLog(shader);
    throw error;
  }

  return shader;
};

const makeProgram = (gl: Gl, vertexSource: string, fragmentSource: string): WebGLProgram => {
  const program = gl.createProgram()!;
  const vertex = makeShader(gl, vertexSource, 'vertex');
  const fragment = makeShader(gl, fragmentSource, 'fragment');

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);

  const success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!success) {
    const error = gl.getProgramInfoLog(program);
    throw error;
  }

  return program;
};

type Mode = 'from-sims' | 'to-sims';

const makeRenderer = (canvas: HTMLCanvasElement) => {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true });

  if (!gl) {
    throw 'Failed to create webgl2 context!';
  }

  const toSimsProgram = makeProgram(gl, vertexShader, toSimsFragmentShader);
  const fromSimsProgram = makeProgram(gl, vertexShader, fromSimsFragmentShader);

  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, fullScreenTriangle, gl.STATIC_DRAW);

  gl.clearColor(1, 1, 1, 1);
  // gl.colorMask(false, false, false, true);
  gl.clear(gl.COLOR_BUFFER_BIT);

  return (mode: Mode, image: HTMLImageElement) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

    const stride = 4 * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 2 * 4);

    const program = mode === 'from-sims'
      ? fromSimsProgram
      : toSimsProgram;

    gl.useProgram(program);

    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    const textureLocation = gl.getUniformLocation(program, 'uTexture');
    gl.uniform1i(textureLocation, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Once we've drawn our image, let's pull it out of the canvas and make a png.
    const { width, height } = image;
    const data = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);

    const outputImage = makeImageFromBuffer(data, width, height);
    const pngData = Png.encode(outputImage);

    const blob = new Blob([pngData], { 'type': 'image/png' });
    const url = URL.createObjectURL(blob);
    console.log(url); 

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = 'converted-normal.png';
    anchor.click();
  };
};

const loadImage = (buffer: ArrayBuffer) => {
  return new Promise<HTMLImageElement>((resolve) => {
    const img = document.createElement('img');
    const url = URL.createObjectURL(new Blob([buffer], { type: 'image/png' }));
    img.onload = () => {
      resolve(img);
    };

    img.src = url;
  });
};

export const NormalConverter = () => {
  const [mode, setMode] = useState<Mode | null>(null);
  const [image, setImage] = useState<HTMLImageElement>();
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const render = useMemo(() => canvas && makeRenderer(canvas), [canvas]);

  const loadTexture = async (result: ArrayBuffer) => {
    const loadedImage = await loadImage(result);
    setImage(loadedImage);
  };

  const onUploadStandardNormal = (file: ArrayBuffer) => {
    setMode('to-sims');
    loadTexture(file);
  };

  const onUploadSimsNormal = (file: ArrayBuffer) => {
    setMode('from-sims');
    loadTexture(file);
  };

  useEffect(() => {
    if (render && image && mode) {
      setTimeout(() => render(mode, image), 100);
    }
  }, [render, image, mode]);

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

      {!image && (
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

      {image && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ width: '100%' }}>
            <Button onClick={() => { setImage(undefined); }}>Back</Button>
          </span>

          <div style={{ maxWidth: '400px', maxHeight: '400px', overflow: 'scroll' }}>
            <div
              style={{
                backgroundColor: 'black',
                position: 'relative',
                height: image.height,
                width: image.width,
              }}
            >
              <canvas ref={setCanvas} width={image.width} height={image.height} />
            </div>
          </div>
          <label>Saved as "converted-normal.png"</label>
        </div>
      )}
    </div>
  )
};
