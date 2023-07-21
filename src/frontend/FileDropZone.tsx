import React, { useRef } from 'react';
import { useFileUpload } from './useFileUpload';
import { Button } from './Button';

type Props = {
  onUpload: (file: ArrayBuffer) => void;
  children?: string | JSX.Element | JSX.Element[];
  extensions?: string[];
};

export const FileDropZone = (props: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const { onDrop, onOpen } = useFileUpload((file) => {
    props.onUpload(file);
  });

  const dropRef = useRef<HTMLDivElement>(null);

  const adjustedExtensions = props.extensions ?? ['*.png', '*.jpg'];
  const extensionElements = adjustedExtensions.join(', ');

  return (
    <div
      ref={dropRef}
      className="app-drop-zone"
      style={{ zIndex: 1000000 }}
      onDrop={onDrop}
      onDragEnter={() => { dropRef.current?.classList.add('on-drag-over'); }}
      onDragLeave={() => { dropRef.current?.classList.remove('on-drag-over'); }}
      onDragOver={(event) => {
        event.stopPropagation();
        event.preventDefault();
      }}
    >
      <input
        type="file"
        onChange={onOpen}
        ref={inputRef}
        style={{ display: 'none' }}
      ></input>

      <span style={{ marginBottom: '8px' }}>{props.children}</span>
      <span>Drag & Drop a file to upload</span>
      <span>{extensionElements}</span>
      <Button onClick={() => { inputRef.current?.click(); }}>
        Select File
      </Button>
    </div>
  );
};