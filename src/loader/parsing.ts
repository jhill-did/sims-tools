import { range } from './iterator';

export enum ParserType { U8, U16, U32, I8, I16, I32, F32, String, Layout }

const factoryHelpers = {
  u8: (count = 1): Entry => ({ type: ParserType.U8, count }),
  u16: (count = 1): Entry => ({ type: ParserType.U16, count }),
  u32: (count = 1): Entry => ({ type: ParserType.U32, count }),
  i8: (count = 1): Entry => ({ type: ParserType.I8, count }),
  i16: (count = 1): Entry => ({ type: ParserType.I16, count }),
  i32: (count = 1): Entry => ({ type: ParserType.I32, count }),
  f32: (count = 1): Entry => ({ type: ParserType.F32, count }),
  string: (bytes = 1): Entry => ({ type: ParserType.String, count: bytes }),
  layout: (layout: Layout, count = 1): LayoutEntry => ({ type: ParserType.Layout, layout, count }),
};

export interface Entry { type: ParserType; count: number }
export type Layout = Record<string, Entry | LayoutEntry>;
interface LayoutEntry { type: ParserType.Layout; layout: Layout; count: number }

// TODO: We should optionally allow passing a constraint T that the factory
// members must also be contained within.
type LayoutFactory = (x: typeof factoryHelpers) => Layout;
export const makeLayout = (factory: LayoutFactory): Layout => factory(factoryHelpers);

const typeSizes = {
  [ParserType.U8]: 1,
  [ParserType.U16]: 2,
  [ParserType.U32]: 4,
  [ParserType.I8]: 1,
  [ParserType.I16]: 2,
  [ParserType.I32]: 4,
  [ParserType.F32]: 4,
  [ParserType.String]: null, // Special case, must be calculated from data.
  [ParserType.Layout]: null,
};

export const sizeOf = (layout: Layout): number => Object.values(layout)
  .map(value => (
    value.type === ParserType.Layout
      ? sizeOf((value as LayoutEntry).layout) * value.count
      : value.type === ParserType.String
        ? value.count
        : (typeSizes[value.type] * value.count) as number
  ))
  .reduce((acc, item) => acc + item);

type ParserMethod<T> = (byteOffset: number, entry: Entry | LayoutEntry) => [number, T];
type EncoderMethod = (
  byteOffset: number,
  value: number | number[] | string | Object,
  entry: Entry | LayoutEntry,
) => number;

const makeMethodHelpers = (data: DataView, littleEndian: boolean) => {
  type Action = (offset: number) => number;
  const makeHelper = (size: number, action: Action) => (offset: number, count: number) => (
    count > 1
      ? range(count).map(index => action((index * size) + offset)).collect()
      : action(offset)
  );

  type SetAction = (offset: number, value: number) => void;
  const makeSetHelper = (size: number, action: SetAction) => (offset: number, value: number | number[] | string | Object, count = 1) => {
    for (let index = 0; index < count; index += 1) {
      const item = Array.isArray(value) ? value[index] : value;
      action((index * size) + offset, item as any);
    }
  };

  return {
    getU8: makeHelper(typeSizes[ParserType.U8], o => data.getUint8(o)),
    getU16: makeHelper(typeSizes[ParserType.U16], o => data.getUint16(o, littleEndian)),
    getU32: makeHelper(typeSizes[ParserType.U32], o => data.getUint32(o, littleEndian)),
    getI8: makeHelper(typeSizes[ParserType.I8], o => data.getInt8(o)),
    getI16: makeHelper(typeSizes[ParserType.I16], o => data.getInt16(o, littleEndian)),
    getI32: makeHelper(typeSizes[ParserType.I32], o => data.getInt32(o, littleEndian)),
    getF32: makeHelper(typeSizes[ParserType.F32], o => data.getFloat32(o, littleEndian)),
    getString: (offset: number, count: number) => {
      const characters = range(count)
        .map((index) => data.getUint8(index + offset))
        .collect();

      return String.fromCharCode(...characters).split('\0')[0];
    },
    setU8: makeSetHelper(typeSizes[ParserType.U8], (o, v) => data.setUint8(o, v)),
    setU16: makeSetHelper(typeSizes[ParserType.U16], (o, v) => data.setUint16(o, v, littleEndian)),
    setU32: makeSetHelper(typeSizes[ParserType.U32], (o, v) => data.setUint32(o, v, littleEndian)),
    setI8: makeSetHelper(typeSizes[ParserType.I8], (o, v) => data.setInt8(o, v)),
    setI16: makeSetHelper(typeSizes[ParserType.I16], (o, v) => data.setInt16(o, v, littleEndian)),
    setI32: makeSetHelper(typeSizes[ParserType.I32], (o, v) => data.setInt32(o, v, littleEndian)),
    setF32: makeSetHelper(typeSizes[ParserType.F32], (o, v) => data.setFloat32(o, v, littleEndian)),
    setString: (offset: number, value: string) => {
      for (let index = 0; index < value.length; index += 1) {
        const character = value.charCodeAt(index);
        data.setUint8(offset + index, character);
      }
    },
  }
};

// Writes `source` into `data` using `layout`.
export const encodeLayout = (
  source: object,
  data: DataView,
  layout: Layout,
  littleEndian = false,
) => {
  const helpers = makeMethodHelpers(data, littleEndian);
  const encoderMethods: Record<ParserType, EncoderMethod> = {
    [ParserType.U8]: (offset, value, entry) => {
      helpers.setU8(offset, value, (entry as Entry).count);
      return typeSizes[ParserType.U8] * (entry as Entry).count;
    },
    [ParserType.U16]: (offset, value, entry) => {
      helpers.setU16(offset, value, (entry as Entry).count);
      return typeSizes[ParserType.U16] * (entry as Entry).count;
    },
    [ParserType.U32]: (offset, value, entry) => { 
      helpers.setU32(offset, value, (entry as Entry).count);
      return typeSizes[ParserType.U32] * (entry as Entry).count;
    },
    [ParserType.I8]: (offset, value, entry) => {
      helpers.setI8(offset, value, (entry as Entry).count);
      return typeSizes[ParserType.I8] * (entry as Entry).count;
    },
    [ParserType.I16]: (offset, value, entry) => {
      helpers.setI16(offset, value, (entry as Entry).count);
      return typeSizes[ParserType.I16] * (entry as Entry).count;
    },
    [ParserType.I32]: (offset, value, entry) => {
      helpers.setI32(offset, value, (entry as Entry).count);
      return typeSizes[ParserType.I32] * (entry as Entry).count;
    },
    [ParserType.F32]: (offset, value, entry) => {
      helpers.setF32(offset, value, (entry as Entry).count);
      return typeSizes[ParserType.F32] * (entry as Entry).count;
    },
    [ParserType.String]: (offset, value, entry) => {
      helpers.setString(offset, value as string);
      return (entry as Entry).count;
    },
    [ParserType.Layout]: (offset, value, entry) => {
      const layoutEntry = entry as LayoutEntry;
      const layoutSize = sizeOf(layoutEntry.layout);
      for (let index = 0; index < layoutEntry.count; index += 1) {
        const itemOffset = offset + (layoutSize * index);
        const offsetData = new DataView(data.buffer, data.byteOffset + itemOffset);
        const item = layoutEntry.count > 1 ? value[index] : value;
        encodeLayout(item as Object, offsetData, layoutEntry.layout, littleEndian);
      }

      return layoutSize * layoutEntry.count;
    },
  };

  let byteOffset = 0;
  for (const [key, entry] of Object.entries(layout)) {
    console.assert(source[key] !== undefined);
    const value = source[key];
    const method = encoderMethods[entry.type];
    const size = method(byteOffset, value, entry);
    byteOffset += size;
  }
}

type ParserResult = Record<string, any>;

// TODO: Maybe should call this decodeLayout?
export const parseLayout = <T,>(data: DataView, layout: Layout, littleEndian = false) => {
  const helpers = makeMethodHelpers(data, littleEndian);
  const parserMethods: Record<ParserType, ParserMethod<number | string | Object>> = {
    [ParserType.U8]: (offset, entry) => ([
      typeSizes[ParserType.U8] * (entry as Entry).count,
      helpers.getU8(offset, (entry as Entry).count),
    ]),
    [ParserType.U16]: (offset, entry) => ([
      typeSizes[ParserType.U16] * (entry as Entry).count,
      helpers.getU16(offset, (entry as Entry).count),
    ]),
    [ParserType.U32]: (offset, entry) => ([
      typeSizes[ParserType.U32] * (entry as Entry).count,
      helpers.getU32(offset, (entry as Entry).count),
    ]),
    [ParserType.I8]: (offset, entry) => ([
      typeSizes[ParserType.I8] * (entry as Entry).count,
      helpers.getI8(offset, (entry as Entry).count),
    ]),
    [ParserType.I16]: (offset, entry) => ([
      typeSizes[ParserType.I16] * (entry as Entry).count,
      helpers.getI16(offset, (entry as Entry).count),
    ]),
    [ParserType.I32]: (offset, entry) => ([
      typeSizes[ParserType.I32] * (entry as Entry).count,
      helpers.getI32(offset, (entry as Entry).count),
    ]),
    [ParserType.F32]: (offset, entry) => ([
      typeSizes[ParserType.F32] * (entry as Entry).count,
      helpers.getF32(offset, (entry as Entry).count),
    ]),
    [ParserType.String]: (offset, entry) => [
      (entry as Entry).count,
      helpers.getString(offset, (entry as Entry).count),
    ],
    [ParserType.Layout]: (offset, entry) => {
      // TODO: Handle count > 1 of sub layouts.
      const layoutEntry = entry as LayoutEntry;
      const offsetData = new DataView(data.buffer, data.byteOffset + offset);
      const child = parseLayout<any>(offsetData, layoutEntry.layout, littleEndian);
      return [sizeOf(layoutEntry.layout), child];
    }
  };

  let byteOffset = 0;
  const result: ParserResult = {};
  for (const [key, entry] of Object.entries(layout)) {
    const method = parserMethods[entry.type];
    const [size, value] = method(byteOffset, entry);
    byteOffset += size;
    result[key] = value;
  }

  return result as T;
};
