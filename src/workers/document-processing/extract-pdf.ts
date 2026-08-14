export type ExtractedPdfPage = {
  pageNumber: number;
  text: string;
};

type PdfTextItem = {
  hasEOL: boolean;
  str: string;
};

function isPdfTextItem(value: unknown): value is PdfTextItem {
  return typeof value === "object"
    && value !== null
    && "str" in value
    && typeof value.str === "string"
    && "hasEOL" in value
    && typeof value.hasEOL === "boolean";
}

function normalizeTextItems(items: unknown[]) {
  const lines: string[] = [];
  let currentLine: string[] = [];

  for (const item of items) {
    if (!isPdfTextItem(item)) continue;

    const fragment = item.str
      .replaceAll("\u0000", "")
      .replace(/[\t ]+/gu, " ")
      .trim();

    if (fragment) currentLine.push(fragment);

    if (item.hasEOL) {
      lines.push(currentLine.join(" "));
      currentLine = [];
    }
  }

  if (currentLine.length) lines.push(currentLine.join(" "));

  return lines
    .join("\n")
    .replace(/[\t ]+\n/gu, "\n")
    .replace(/\n[\t ]+/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

export async function extractDigitalPdfPages(
  bytes: Uint8Array,
): Promise<ExtractedPdfPage[]> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = getDocument({
    data: bytes,
    disableFontFace: true,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  const pages: ExtractedPdfPage[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);

      try {
        const content = await page.getTextContent();
        pages.push({
          pageNumber,
          text: normalizeTextItems(content.items),
        });
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await loadingTask.destroy();
  }

  return pages;
}
