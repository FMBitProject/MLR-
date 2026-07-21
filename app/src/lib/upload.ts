// Maximum size of an uploaded content file (PPTX/PDF/DOCX).
//
// The binding constraint is the host, not the app: on Vercel a Function's
// request body is hard-capped at 4.5 MB and anything larger is rejected with
// a 413 before our code runs — `serverActions.bodySizeLimit` cannot raise it.
// The form sends the file through a Server Action, so the file plus the
// multipart overhead (boundaries, part headers, the other form fields) has to
// stay under that ceiling. 4 MB leaves ~700 KB of headroom.
//
// Raising this meaningfully means not sending file bytes through a Function
// at all: upload straight from the browser to object storage (R2/S3/Blob) via
// a presigned URL and pass only the key to the Server Action. See storage.ts.
export const MAX_UPLOAD_MB = 4;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
