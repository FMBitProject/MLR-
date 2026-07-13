// Content types for the file formats we accept as content uploads.
const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function mimeForFileName(fileName: string | null | undefined): string {
  if (!fileName) return "application/octet-stream";
  const dot = fileName.lastIndexOf(".");
  const ext = dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
  return MIME[ext] ?? "application/octet-stream";
}
