
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

export const useFileUpload = (onUpload: (result: ArrayBuffer) => void) => {
  const onDrop = (event: React.DragEvent<HTMLInputElement>) => {
    event.stopPropagation();
    event.preventDefault();
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