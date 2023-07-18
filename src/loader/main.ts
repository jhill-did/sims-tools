import { Vertex, makeObj } from './obj';
import {
  makeLayout,
  parseLayout,
  sizeOf,
} from './parsing';
import { range } from './iterator';

// position, normal, uv, blend, blendWeight, tangent
// stride 28.
// [
//  00: x-,y-,z-,w- position (Short4)
//  08: x,y,z,w     normal (ColorUByte4)
//  12: x-,y-       uv (Short2)
//  16: x,y,z,w,    blend-index (UByte4)
//  20: x,y,z,w     blend-weight (ColorUByte4)
//  24: x,y,z,w     tangent (ColorUByte4)
// ]

// TODO: Read the vertexCount and indexCount from the mesh data.

type Rcol = number;

type MeshBounds = {
  min: [number, number, number];
  max: [number, number, number];
};

type Mesh = {
  nameId: Rcol;
  materialIndex: number;
  vertexFormatIndex: number;
  vertexBufferIndex: number; // NOTE: vbuf indices are 1 based.
  indexBufferIndex: number; // NOTE: ibuf indices are 1 based.
  primitiveType: number;
  flags: number;
  streamOffset: number;
  startVertex: number;
  startIndex: number;
  minVertexIndex: number;
  vertexCount: number;
  primitiveCount: number;
  bounds: MeshBounds;
  // ...
  mirrorPlane: [number, number, number, number];
};

const meshBoundsLayout = makeLayout((x) => ({
  min: x.f32(3),
  max: x.f32(3),
}));

const panic = (message: string) => {
  console.error(message);
  throw message;
};

type PackageHeader = {
  magicNumber: string;
  major: number;
  minor: number;
  unknown1: number[],
  indexCount: number,
  unknown2: number[],
  indexSizeInBytes: number,
  unknown3: number[],
  indexVersion: 3, // Always 3.
  indexPosition: number,
  unknown4: number[],
};

const readPackageHeader = (buffer: ArrayBuffer) => {
  const packageHeaderLayout = makeLayout(x => ({
    magicNumber: x.string(4),
    major: x.u32(),
    minor: x.u32(),
    unknown1: x.u8(24),
    indexCount: x.u32(),
    unknown2: x.u8(4),
    indexSizeInBytes: x.u32(),
    unknown3: x.u8(12),
    indexVersion: x.u32(), // Always 3.
    indexPosition: x.u32(),
    unknown4: x.u8(28),
  }));

  const dataView = new DataView(buffer);
  const packageHeader = parseLayout<PackageHeader>(
    dataView,
    packageHeaderLayout,
    true,
  );

  // Check that this is indeed a Sims 3 package file.
  const valid = packageHeader.magicNumber === 'DBPF'
    && packageHeader.major === 2
    && packageHeader.minor === 0
    && packageHeader.indexVersion === 3;

  // TODO: Also check for DBPP magic number which is apparently an ecrypted
  // package, which we'll want to tell the user we don't support.

  if (!valid) {
    panic('Invalid file!');
  }

  // Also check that our index list isn't empty.
  if (packageHeader.indexCount === 0) {
    panic('Package is empty.');
  }

  return packageHeader;
};

type PackageIndex = {
  resourceType: number;
  resourceGroup: number;
  instanceHi: number;
  instanceLo: number;
  chunkOffset: number;
  fileSize: number; // low 31 bits, extra 1 high bit of garbage.
  memSize: number;
  compressed: number;
  _unknown: number;
};

const readPackageIndices = (file: ArrayBuffer, packageHeader: PackageHeader) => {
  // The index header has a variable size depending on which properties
  // are included, indicated by the index type bitfield.
  const byteOffset = packageHeader.indexPosition;
  const indexBitflagsView = new DataView(file);
  const indexBitflags = indexBitflagsView.getUint32(byteOffset, true);

  // My test file happens to have no bits set meaning the header has a size
  // of zero and the regular index data begins immediately after the
  // indexBitflags is specified.
  if (indexBitflags !== 0) {
    panic('This package uses index compression!');
  }

  const indexLayout = makeLayout(x => ({
    resourceType: x.u32(),
    resourceGroup: x.u32(),
    instanceHi: x.u32(),
    instanceLo: x.u32(),
    chunkOffset: x.u32(),
    fileSize: x.u32(),
    memSize: x.u32(),
    compressed: x.u16(),
    _unknown: x.u16(),
  }));

  const indices = range(packageHeader.indexCount)
    .map((index) => {
      // Skip our index bitflags (4 bytes at the index location).
      const offset = (byteOffset + 4) + (sizeOf(indexLayout) * index);
      const view = new DataView(file, offset);
      const indexHeader = parseLayout<PackageIndex>(view, indexLayout, true);

      // We need to fix up the fileSize because it's encoded in a weird way.
      // Apparently the low 31 bits are the fileSize, but it's got an extra
      // high bit of garbage(?).
      const lowMask = (0xFFFFFFFF ^ 1 << 31);
      const adjustedSize = indexHeader.fileSize & lowMask;
      indexHeader.fileSize = adjustedSize;

      return indexHeader;
    })
    .collect();

  return indices;
};

const readMlodMesh = () => {

};

const readMlodChunk = (buffer: ArrayBuffer, packageIndex: PackageIndex) => {
  type ChunkHeader = {
    version: number;
    publicChunkCount: number;
    _unused1: number;
    externalCount: number;
    internalCount: number;
  };

  const chunkHeaderLayout = makeLayout(x => ({
    version: x.u32(),
    publicChunkCount: x.u32(),
    _unused1: x.u32(),
    externalCount: x.u32(),
    internalCount: x.u32(),
  }));

  const { chunkOffset } = packageIndex;
  const chunkView = new DataView(buffer, chunkOffset);
  const chunkHeader = parseLayout<ChunkHeader>(chunkView, chunkHeaderLayout, true);

  // After the header we have some chunk info blocks which I don't really
  // care about. The chunk info blocks are (u64 + u32 + u32) long or 16 bytes.
  // And we'll have one of these blocks for each of our
  // internal & external counts.
  const { internalCount, externalCount } = chunkHeader;
  const chunkInfoSize = 16;
  const chunkInfoBlockSize = (internalCount + externalCount) * chunkInfoSize;

  const chunkListingOffset = chunkOffset
    + sizeOf(chunkHeaderLayout)
    + chunkInfoBlockSize;

  const chunkListing = range(chunkHeader.internalCount)
    .map((index) => {
      // Each listing is two u32s.
      const listingSize = 4 + 4;
      const listingOffset = chunkListingOffset + (index * listingSize);
      const view = new DataView(buffer, listingOffset);
      const chunkPosition = view.getUint32(0, true);
      const chunkSize = view.getUint32(4, true);

      // The chunk listing doesn't identify the kind of data contained in the
      // chunk which is pretty obnoxious so we'll have to scan ahead into the
      // chunk data to figure out what the chunk's tag is.

      // Also note that these chunkPositions are offsets from the start of the
      // mlod chunk not the start of the package.
      const chunkView = new DataView(buffer, chunkOffset + chunkPosition);

      const tagBytes = range(4)
        .map(index => chunkView.getUint8(index))
        .collect()

      const chunkTag = String.fromCharCode(...tagBytes);

      return {
        tag: chunkTag,
        chunkPosition,
        chunkSize,
      };
    })
    .collect();

  // I'm just going to guess that an MLOD chunk only
  // has a single MLOD block in it.
  const mlodListing = chunkListing.find(chunk => chunk.tag === 'MLOD');

  if (!mlodListing) {
    throw 'Failed to find MLOD data in MLOD chunk.';
  }

  type MlodHeader = {
    tag: 'MLOD';
    version: number;
    meshCount: number;
  };

  const mlodHeaderLayout = makeLayout((x) => ({
    tag: x.string(4),
    version: x.u32(),
    meshCount: x.u32(),
  }));

  const mlodStart = chunkOffset + mlodListing.chunkPosition;
  const mlodView = new DataView(buffer, mlodStart);
  const mlodHeader = parseLayout<MlodHeader>(mlodView, mlodHeaderLayout, true);

  if (mlodHeader.version !== 515) {
    throw 'Invalid MLOD version';
  }

  const meshLayout = makeLayout((x) => ({
    structSize: x.u32(), // The size of this struct in bytes.
    nameId: x.u32(),
    materialIndex: x.u32(),
    vertexFormatIndex: x.u32(),
    vertexBufferIndex: x.u32(),
    indexBufferIndex: x.u32(),
    flags: x.u32(),
    streamOffset: x.u32(),
    startVertex: x.u32(),
    startIndex: x.u32(),
    minVertexIndex: x.u32(),
    vertexCount: x.u32(),
    primitiveCount: x.u32(),
    bounds: x.layout(meshBoundsLayout),
    // ...
    mirrorPlane: x.f32(4),
  }));

  // The mesh descriptors don't have a guaranteed size beacuse different
  // versions have additional properties. The struct's first member tells
  // you how long the struct will be. So let's peek at the first four bytes
  // to determine how big our mesh struct is.
  const meshListStart = mlodStart + sizeOf(mlodHeaderLayout);
  const meshHeaderSize = new DataView(buffer, meshListStart).getUint32(0, true);

  const meshList = range(mlodHeader.meshCount)
    .map((index) => {
      const offset = index * (meshHeaderSize + 4);
      const meshListData = new DataView(buffer, meshListStart + offset);
      const mesh = parseLayout<Mesh>(meshListData, meshLayout, true);

      // We have to fix up the first two bits of our buffer indices,
      // because there's an embedded flag indicating that the value is private.
      mesh.indexBufferIndex &= 0x0FFFFFFF;
      mesh.vertexBufferIndex &= 0x0FFFFFFF;
      return mesh;
    })
    .collect();

  // TODO: This sliceRange is old and sucks ass I should use parsing for this.
  const sliceRange = ([start, stop]: number[]) => {
    return new DataView(buffer.slice(start, stop));
  };

  // From a mesh descriptor, read the mesh data out of the corresponding
  // vbuf and ibuf.
  const readMeshData = (mesh: Mesh) => {
    // Find our vbuf and ibuf data chunks.
    const vbufChunk = chunkListing[mesh.vertexBufferIndex];
    const vbufStart = vbufChunk.chunkPosition;

    const ibufChunk = chunkListing[mesh.indexBufferIndex];
    const ibufStart = ibufChunk.chunkPosition;

    // Load our vbuf.
    type VbufHeader = {
      tag: 'VBUF';
      version: number;
      flags: number;
      swizzleInfoId: number;
    };

    const vbufHeaderLayout = makeLayout(x => ({
      tag: x.string(4),
      version: x.u32(),
      flags: x.u32(), // 0
      swizzleInfoId: x.u32(),
    }));

    const vbufView = new DataView(buffer, chunkOffset + vbufStart);
    const vbufHeader = parseLayout<VbufHeader>(vbufView, vbufHeaderLayout, true);

    if (vbufHeader.tag !== 'VBUF' || vbufHeader.version !== 0x00000101) {
      throw 'Invalid VBUF';
    }

    const readVertex = (fileOffset: number): Vertex => {
      const position = [fileOffset, fileOffset + 8];

      const w = sliceRange(position).getInt16(6, true) || 32768;

      const positionBlock = [
        sliceRange(position).getInt16(0, true) / w,
        sliceRange(position).getInt16(2, true) / w,
        sliceRange(position).getInt16(4, true) / w,
      ];

      const normalRange = [position[1], position[1] + 4];
      const normal = sliceRange(normalRange);

      const scalingFactor = (255 - normal[3]) || 128;

      const normalBlock = [
        (normal.getUint8(2) - 128) / scalingFactor,
        (normal.getUint8(1) - 128) / scalingFactor,
        (normal.getUint8(0) - 128) / scalingFactor,
      ];

      // TODO: Divide by UVScales from the MATD shader data chunk.
      // if the values are zero divide by 32767 like we're doing.
      const uv = [normalRange[1], normalRange[1] + 4];

      const uvBlock = [
        sliceRange(uv).getInt16(0, true) / 32767,
        sliceRange(uv).getInt16(2, true) / 32767,
      ];

      return {
        position: positionBlock as [number, number, number],
        normal: normalBlock as [number, number, number],
        uv: uvBlock as [number, number],
      };
    };

    const baseOffset = chunkOffset + vbufStart + sizeOf(vbufHeaderLayout);
    const vertexCount = mesh.vertexCount; // 3552; // 626;
    const stride = 28;
    const vertices = [...Array(vertexCount)]
      .map((_, index) => {
        const offset = baseOffset + (index * stride);
        const v = readVertex(offset);
        return v;
      });

    // Load our ibuf.
    // TODO: Use parser for this.
    const ibufVersion = [ibufStart + 4, ibufStart + 8];
    const ibufFlags = [ibufVersion[1], ibufVersion[1] + 4];
    const ibufUsage = [ibufFlags[1], ibufFlags[1] + 4];

    // console.log('ibuf version', sliceRange(ibufVersion));
    // console.log('ibuf flags', sliceRange(ibufFlags));
    // console.log('ibuf usage', sliceRange(ibufUsage));

    const ibufDataStart = chunkOffset + ibufUsage[1];

    // We expect to see 1380 faces.
    // 1380 * 3 is 4140 indices, and apparently they are 16 bit.
    // According to the sims wiki this is encoded with some compression scheme
    // where we need to start at 0 and add each signed 16 bit value as we go
    // to decode each actual index.
    const faceCount = mesh.primitiveCount;
    const indexCount = faceCount * 3;

    let indices: number[] = [];

    const view = new DataView(buffer);

    let acc = 0;
    for (let index = 0; index < indexCount; index += 1) {
      const diff = view.getInt16(ibufDataStart + (index * 2), true);
      acc += diff;

      indices.push(acc);
    }

    return { vertices, indices };
  };

  const meshes = meshList
    .map((meshHeader, index) => {
      const geometry = readMeshData(meshList[index]);
      return { header: meshHeader, geometry };
    });

  return { mlodHeader, meshes };
};

// TODO: Rework this to read the whole package content.
export const readPackageMlods = (file: ArrayBuffer) => {
  const packageHeader = readPackageHeader(file);

  const packageIndices = readPackageIndices(file, packageHeader);

  const mlodTag = 0x01D10F34;
  const mlodIndices = packageIndices
    .filter(index => index.resourceType === mlodTag);

  const mlods = mlodIndices.map(index => readMlodChunk(file, index));

  return mlods;
};
