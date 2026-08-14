import OpenAI from "openai";

import { EMBEDDING_DIMENSIONS } from "./config.ts";

export interface EmbeddingProvider {
  readonly dimensions: number;
  readonly model: string;
  embed(texts: readonly string[]): Promise<number[][]>;
}

export class EmbeddingProviderError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "EmbeddingProviderError";
  }
}

export function validateEmbeddingBatch(
  embeddings: readonly (readonly number[])[],
  expectedCount: number,
  expectedDimensions = EMBEDDING_DIMENSIONS,
) {
  if (embeddings.length !== expectedCount) {
    throw new EmbeddingProviderError(
      "INVALID_EMBEDDING_RESPONSE",
      "The embedding provider returned an unexpected number of vectors.",
    );
  }

  for (const embedding of embeddings) {
    if (
      embedding.length !== expectedDimensions ||
      embedding.some((coordinate) => !Number.isFinite(coordinate))
    ) {
      throw new EmbeddingProviderError(
        "INVALID_EMBEDDING_RESPONSE",
        `The embedding provider must return ${expectedDimensions} finite coordinates per vector.`,
      );
    }
  }
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions = EMBEDDING_DIMENSIONS;
  readonly model: string;
  private readonly client: OpenAI;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async embed(texts: readonly string[]) {
    if (texts.length === 0) return [];

    let response;

    try {
      response = await this.client.embeddings.create({
        dimensions: this.dimensions,
        encoding_format: "float",
        input: [...texts],
        model: this.model,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown provider error.";
      throw new EmbeddingProviderError(
        "EMBEDDING_PROVIDER_FAILED",
        `OpenAI embedding request failed: ${message}`,
      );
    }

    const embeddings = [...response.data]
      .sort((left, right) => left.index - right.index)
      .map((item) => item.embedding);

    validateEmbeddingBatch(embeddings, texts.length, this.dimensions);
    return embeddings;
  }
}
