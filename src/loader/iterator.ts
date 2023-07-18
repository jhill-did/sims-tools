
// NOTE: Shorthand because TNext is the part we care about.
type Itr<T> = Iterator<T, T>;
type Mapping<T, U = T> = (x: T, index: number) => U;
type FilterPredicate<T> = (x: T, index: number) => boolean;
type Action<T> = (x: T, index: number) => void;
type Reducer<T, U = T> = (acc: U, x: T, index: number) => U;

interface IterHelper<T> {
  map: <U = T>(mapping: Mapping<T, U>) => IterHelper<U>;
  flatMap: <U = T>(mapping: Mapping<T, U[]>) => U[];
  filter: (predicate: FilterPredicate<T>) => IterHelper<T>;
  collect: () => T[];
  take: (count: number) => T[];
  forEach: (action: Action<T>) => void;
  reduce: <U = T>(reducer: Reducer<T, U>, defaultValue: U) => U;
  length: () => number;
  find: (predicate: FilterPredicate<T>) => T | undefined;
}

export const range = (start: number, end?: number): IterHelper<number> => {
  const adjustedStart = end === undefined ? 0 : start;
  const adjustedEnd = end === undefined ? start : end;
  const direction = Math.sign(adjustedEnd - adjustedStart);
  const comparison = (index: number) => direction > 0
    ? index < adjustedEnd
    : index > adjustedEnd;

  let index = adjustedStart;

  const nextItr: Itr<number> = {
    next: (): IteratorResult<number> => {
      if (!comparison(index)) {
        return { value: index, done: true };
      }

      const result = { value: index, done: false };
      index += direction;
      return result;
    }
  };

  return wrapIterator(nextItr);
}

const map = <T, U = T>(itr: Itr<T>) => (mapping: Mapping<T, U>): IterHelper<U> => {
  let index = 0;
  const nextItr = {
    next: () => {
      const { value, done } = itr.next();
      if (done) { return { value: undefined, done }; }
      const result = mapping(value, index);
      index += 1;
      return { value: result, done };
    },
  };

  return wrapIterator(nextItr);
};

const filter = <T,>(itr: Itr<T>) => (predicate: FilterPredicate<T>) => {
  let index = 0;
  const nextItr = {
    next: () => {
      while (true) {
        const { value, done } = itr.next();
        if (done || predicate(value, index)) {
          index += 1;
          return { value, done };
        }
      }
    },
  };

  return wrapIterator(nextItr);
};

const forEach = <T,>(itr: Itr<T>) => (action: Action<T>): void => {
  let index = 0;
  while (true) {
    const { value, done } = itr.next();
    if (done) { return; }

    action(value, index);
    index += 1;
  }
};

const collect = <T,>(itr: Itr<T>) => () => {
  const result: T[] = [];
  while (true) {
    const { value, done } = itr.next();
    if (done) { break; }
    result.push(value);
  }

  return result;
};

const take = <T,>(itr: Itr<T>) => (count: number): T[] => {
  const result: T[] = [];

  for (let index = 0; index < count; index += 1) {
    const { value, done } = itr.next();
    if (done) { break; }

    result.push(value);
  }

  return result;
};

const reduce = <T>(itr: Itr<T>) => <U>(reducer: Reducer<T, U>, defaultValue: U): U => {
  let index = 0;
  let acc = defaultValue;
  while (true) {
    const { value, done } = itr.next();
    if (done) { break; }

    acc = reducer(acc, value, index);
    index += 1;
  }

  return acc;
};

const length = <T>(itr: Itr<T>) => () => {
  let count = 0;
  while (true) {
    const { done } = itr.next();
    if (done) { break; }
    count += 1;
  }

  return count;
};

const flatMap = <T>(itr: Itr<T>) => <U>(mapping: Mapping<T, U[]>): U[] => {
  let index = 0;
  let results: U[] = [];
  while (true) {
    const { value, done } = itr.next();
    if (done) { break; }

    results.push(...mapping(value, index));
    index += 1;
  }

  return results;
};

const find = <T>(itr: Itr<T>) => (predicate: FilterPredicate<T>): T | undefined => {
  let index = 0;
  while (true) {
    const { value, done } = itr.next();
    if (done) { return; }

    if (predicate(value, index)) {
      return value;
    }

    index += 1;
  }
}

const wrapIterator = <T>(itr: Itr<T>): IterHelper<T> => ({
  map: map(itr),
  filter: filter(itr),
  collect: collect(itr),
  take: take(itr),
  forEach: forEach(itr),
  reduce: reduce(itr),
  length: length(itr),
  flatMap: flatMap(itr),
  find: find(itr),
});

export const fromList = <T>(list: T[]): IterHelper<T> => wrapIterator(list.values());

function* innerRange(start: number, end?: number) {
  const adjustedStart = end === undefined ? 0 : start;
  const adjustedEnd = end === undefined ? start : end;
  const direction = Math.sign(adjustedEnd - adjustedStart);
  const comparison = (index: number) => direction > 0
    ? index < adjustedEnd
    : index > adjustedEnd;

  for (let index = adjustedStart; comparison(index); index += direction) {
    yield index;
  }
}

export const _range = (start: number, end?: number) => [...innerRange(start, end)];
