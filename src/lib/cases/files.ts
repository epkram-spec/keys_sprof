export const caseFileBucket = "case-files";

export const allowedCaseFileTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "video/mp4",
  "video/quicktime",
];

export const allowedCaseFileExtensions = [".jpg", ".jpeg", ".png", ".webp", ".pdf", ".mp4", ".mov"];

export type CaseFileRow = {
  id: string;
  case_id: string;
  uploaded_by_user_id: string | null;
  storage_bucket: string;
  storage_path: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  uploader?: {
    display_name: string | null;
    email: string;
  } | null;
};

export function isAllowedCaseFile(file: File) {
  const lowerName = file.name.toLowerCase();
  return (
    allowedCaseFileTypes.includes(file.type) &&
    allowedCaseFileExtensions.some((extension) => lowerName.endsWith(extension))
  );
}
