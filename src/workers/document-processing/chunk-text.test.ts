import assert from "node:assert/strict";
import test from "node:test";

import { chunkPageText } from "./chunk-text.ts";

test("empty and whitespace-only pages do not create chunks", () => {
  assert.deepEqual(chunkPageText(""), []);
  assert.deepEqual(chunkPageText("  \n\t  "), []);
});

test("chunking is deterministic, bounded, and uses exact page offsets", () => {
  const text = Array.from(
    { length: 500 },
    (_, index) => `Requisito tecnico ${index + 1}.`,
  ).join(" ");

  const firstRun = chunkPageText(text);
  const secondRun = chunkPageText(text);

  assert.deepEqual(firstRun, secondRun);
  assert.ok(firstRun.length > 1);

  for (const chunk of firstRun) {
    assert.ok(chunk.content.length > 0);
    assert.ok(chunk.content.length <= 1_600);
    assert.equal(
      chunk.content,
      text.slice(chunk.characterStart, chunk.characterEnd),
    );
  }
});

test("chunking retains a small overlap without producing duplicate starts", () => {
  const text = Array.from(
    { length: 220 },
    (_, index) => `voce-${index.toString().padStart(3, "0")}`,
  ).join(" ");
  const chunks = chunkPageText(text, { chunkSize: 240, overlap: 40 });

  assert.ok(chunks.length > 2);

  for (let index = 1; index < chunks.length; index += 1) {
    assert.ok(chunks[index].characterStart > chunks[index - 1].characterStart);
    assert.ok(chunks[index].characterStart < chunks[index - 1].characterEnd);
  }
});
