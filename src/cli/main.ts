import * as fs from 'fs';
import { makeObj } from '../loader/obj';
import { readPackageMlods } from '../loader/main';

const start = () => {
  console.log('Starting');
  const file = fs.readFileSync('./Bedding-Bales-uncompressed.package');

  const mlods = readPackageMlods(file);

  const objs = mlods
    .map((mlod) => {
      return mlod.meshes
        .map((mesh) => {
          const { vertices, indices } = mesh.geometry;
          return makeObj(vertices, indices);
        });
    });

  console.log(objs);

  const obj = objs[0][1];
  fs.writeFileSync('./output.obj', obj);

  console.log('done');
};

start();