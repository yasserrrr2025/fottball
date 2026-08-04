export type OcrResult = {
  extractedIban: string | null;
  status: "matched" | "mismatched" | "not_found" | "unsupported" | "failed";
  confidence: number | null;
};

function normalizeIban(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export async function verifyIbanFromFile(buffer: Buffer, mimeType: string, enteredIban: string): Promise<OcrResult> {
  if (!mimeType.startsWith("image/")) {
    return { extractedIban: null, status: "unsupported", confidence: null };
  }
  try {
    const { recognize } = await import("tesseract.js");
    const result = await recognize(buffer, "eng");
    const compact = normalizeIban(result.data.text);
    const matches = compact.match(/SA\d{22}/g) ?? [];
    const extracted = matches[0] ?? null;
    if (!extracted) return { extractedIban: null, status: "not_found", confidence: result.data.confidence ?? null };
    return {
      extractedIban: extracted,
      status: extracted === normalizeIban(enteredIban) ? "matched" : "mismatched",
      confidence: result.data.confidence ?? null,
    };
  } catch {
    return { extractedIban: null, status: "failed", confidence: null };
  }
}
