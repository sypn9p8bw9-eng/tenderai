export const DEFAULT_CHUNK_SIZE = 1_600;
export const DEFAULT_CHUNK_OVERLAP = 160;

export type PageTextChunk = {
  characterEnd: number;
  characterStart: number;
  content: string;
};

type ChunkOptions = {
  chunkSize?: number;
  overlap?: number;
};

function isWhitespace(value: string | undefined) {
  return value !== undefined && /\s/u.test(value);
}

function findNaturalEnd(text: string, start: number, hardEnd: number) {
  if (hardEnd >= text.length) return text.length;

  const minimumUsefulEnd = start + Math.floor((hardEnd - start) * 0.65);
  const newlineEnd = text.lastIndexOf("\n", hardEnd);
  const spaceEnd = text.lastIndexOf(" ", hardEnd);
  const candidate = Math.max(newlineEnd, spaceEnd);

  return candidate >= minimumUsefulEnd ? candidate : hardEnd;
}

function findNextStart(text: string, desiredStart: number, previousEnd: number) {
  let nextStart = desiredStart;

  while (
    nextStart < previousEnd
    && nextStart > 0
    && !isWhitespace(text[nextStart - 1])
  ) {
    nextStart += 1;
  }

  while (nextStart < previousEnd && isWhitespace(text[nextStart])) {
    nextStart += 1;
  }

  return nextStart;
}

export function chunkPageText(
  text: string,
  options: ChunkOptions = {},
): PageTextChunk[] {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options.overlap ?? DEFAULT_CHUNK_OVERLAP;

  if (!Number.isInteger(chunkSize) || chunkSize < 2) {
    throw new Error("Chunk size must be an integer greater than one.");
  }

  if (!Number.isInteger(overlap) || overlap < 0 || overlap >= chunkSize) {
    throw new Error("Chunk overlap must be a non-negative integer smaller than the chunk size.");
  }

  const chunks: PageTextChunk[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    while (cursor < text.length && isWhitespace(text[cursor])) cursor += 1;
    if (cursor >= text.length) break;

    const hardEnd = Math.min(cursor + chunkSize, text.length);
    let characterEnd = findNaturalEnd(text, cursor, hardEnd);

    while (characterEnd > cursor && isWhitespace(text[characterEnd - 1])) {
      characterEnd -= 1;
    }

    if (characterEnd <= cursor) break;

    chunks.push({
      characterEnd,
      characterStart: cursor,
      content: text.slice(cursor, characterEnd),
    });

    if (characterEnd >= text.length) break;

    const desiredStart = Math.max(characterEnd - overlap, cursor + 1);
    const nextStart = findNextStart(text, desiredStart, characterEnd);
    cursor = nextStart > cursor ? nextStart : characterEnd;
  }

  return chunks;
}
