
type Vec3 = [number, number, number];
type Vec2 = [number, number];

export type Vertex = {
  position: Vec3;
  normal: Vec3;
  uv: Vec2;
};

export const makeObj = (
  vertices: Vertex[],
  indices: number[],
  indexOffset = 0,
) => {
  const positions = vertices
    .map(v => {
      const [x, y, z] = v.position;
      return `v ${x} ${y} ${z}`;
    });

  const normals = vertices
    .map(v => {
      const [x, y, z] = v.normal;
      return `vn ${x} ${y} ${z}`;
    });

  const uvs = vertices
    .map(v => {
      const [x, y] = v.uv;
      return `vt ${x} ${y}`;
    });

  let faces: string[] = [];
  for (let index = 0; index < indices.length; index += 3) {
    // Obj faces are 1 based indices.
    const v0 = indices[index + 0] + 1 + indexOffset;
    const v1 = indices[index + 1] + 1 + indexOffset;
    const v2 = indices[index + 2] + 1 + indexOffset;

    faces.push(`f ${v0}/${v0}/${v0} ${v1}/${v1}/${v1} ${v2}/${v2}/${v2}`);
  }

  return `
    ${positions.join('\n')}
    ${uvs.join('\n')}
    ${normals.join('\n')}
    ${faces.join('\n')}
  `;
};

type Model = {
  meshes: { vertices: Vertex[], indices: number[] }[];
};

export const makeObjFromModel = (model: Model) => {
  let indexOffset = 0;
  const combinedMeshes = model.meshes.flatMap((mesh, index) => {
    const { vertices, indices } = mesh;
    const obj = makeObj(vertices, indices, indexOffset);
    indexOffset += vertices.length;

    const groupName = `o mesh${index}\n`;
    return groupName + obj;
  });

  return combinedMeshes.join('\n');
};