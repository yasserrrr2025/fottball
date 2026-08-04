import { BANKS } from "@/lib/banks";
import { z } from "zod";

export const nationalIdSchema = z.string().regex(/^\d{10}$/, "رقم الهوية يجب أن يتكون من 10 أرقام");
export const ibanSchema = z.string().transform((v) => v.replace(/\s|-/g, "").toUpperCase()).pipe(z.string().regex(/^SA\d{22}$/, "الآيبان يجب أن يبدأ بـ SA ويتكون من 24 خانة"));
export const phoneSchema = z.string().transform((v) => v.replace(/\D/g, "")).pipe(z.string().regex(/^(05\d{8}|9665\d{8})$/, "رقم الجوال غير صحيح"));

export const submissionSchema = z.object({
  nationalId: nationalIdSchema,
  hasStudentAccount: z.enum(["yes", "no"]),
  iban: ibanSchema,
  bankName: z.enum(BANKS, { message: "اختر اسم البنك من القائمة" }),
  guardianName: z.string().optional(),
  guardianPhone: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.hasStudentAccount === "no") {
    if (!data.guardianName || data.guardianName.trim().length < 4) ctx.addIssue({ code: "custom", path: ["guardianName"], message: "اسم ولي الأمر مطلوب" });
    const parsed = phoneSchema.safeParse(data.guardianPhone ?? "");
    if (!parsed.success) ctx.addIssue({ code: "custom", path: ["guardianPhone"], message: "رقم جوال ولي الأمر غير صحيح" });
  }
});
