import crypto from "node:crypto";

export const CONSENT_VERSION = "2026-08-v1";
export const CONSENT_TEXT = "أقر بصحة البيانات المدخلة وأوافق على استخدامها لغرض تسجيل وصرف مستحقات بطولة دوري المدارس.";

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (/^05\d{8}$/.test(digits)) return `966${digits.slice(1)}`;
  if (/^5\d{8}$/.test(digits)) return `966${digits}`;
  return digits;
}

export function hashValue(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function createCorrectionToken() {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, hash: hashValue(token) };
}

export function detectSaudiBankCode(iban: string) {
  const normalized = iban.replace(/\s|-/g, "").toUpperCase();
  return /^SA\d{22}$/.test(normalized) ? normalized.slice(4, 6) : null;
}

export function messageForStatus(name: string, status: string, reason?: string | null, correctionUrl?: string | null) {
  if (status === "approved") return `مرحبًا ${name}، تم اعتماد بياناتك في منصة فريق أبطال دوري المدارس U13 بمدرسة عماد الدين زنكي المتوسطة.`;
  if (status === "returned_for_correction") return `مرحبًا ${name}، أعيدت بياناتك للتصحيح. السبب: ${reason || "يرجى مراجعة البيانات"}.${correctionUrl ? ` رابط التصحيح: ${correctionUrl}` : ""}`;
  if (status === "rejected") return `مرحبًا ${name}، تعذر اعتماد بياناتك. السبب: ${reason || "يرجى التواصل مع إدارة المدرسة"}.`;
  return `مرحبًا ${name}، تم استلام بياناتك وهي الآن قيد المراجعة.`;
}
