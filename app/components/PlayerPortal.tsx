"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { BadgeCheck, Building2, CheckCircle2, ChevronDown, FileImage, Loader2, RotateCcw, Search, ShieldCheck, UploadCloud, UserRound } from "lucide-react";
import { BANKS } from "@/lib/banks";

type Student = { id: string; name: string; status: string; returnReason?: string | null; submission?: any };

export default function PlayerPortal() {
  const [nationalId, setNationalId] = useState("");
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [hasAccount, setHasAccount] = useState<"yes" | "no" | "">("");
  const [iban, setIban] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankSearch, setBankSearch] = useState("");
  const [bankOpen, setBankOpen] = useState(false);
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);

  const canEdit = useMemo(() => student && !["pending_review", "approved"].includes(student.status), [student]);
  const filteredBanks = useMemo(() => {
    const query = bankSearch.trim().toLowerCase();
    return query ? BANKS.filter((bank) => bank.toLowerCase().includes(query)) : BANKS;
  }, [bankSearch]);

  async function verify() {
    setMessage("");
    if (!/^\d{10}$/.test(nationalId)) return setMessage("أدخل رقم الهوية أو الإقامة المكون من 10 أرقام.");
    setLoading(true);
    try {
      const response = await fetch("/api/student/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nationalId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "تعذر التحقق");
      setStudent(result.student);
      setShowWelcome(true);
      const previous = result.student.submission;
      if (previous) {
        setHasAccount(previous.has_student_bank_account ? "yes" : "no");
        setIban(previous.student_iban || previous.guardian_iban || "");
        setBankName(previous.bank_name || "");
        setBankSearch(previous.bank_name || "");
        setGuardianName(previous.guardian_name || "");
        setGuardianPhone(previous.guardian_phone || "");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "حدث خطأ"); }
    finally { setLoading(false); }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!BANKS.includes(bankName as (typeof BANKS)[number])) return setMessage("اختر اسم البنك من القائمة الظاهرة.");
    if (!file && !student?.submission?.iban_attachment_path) return setMessage("أرفق صورة أو ملف شهادة الآيبان.");
    setLoading(true);
    const body = new FormData();
    body.set("nationalId", nationalId);
    body.set("hasStudentAccount", hasAccount);
    body.set("iban", iban);
    body.set("bankName", bankName);
    body.set("guardianName", guardianName);
    body.set("guardianPhone", guardianPhone);
    body.set("consentAccepted", String(consentAccepted));
    if (file) body.set("attachment", file);
    try {
      const response = await fetch("/api/student/submit", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "تعذر إرسال الطلب");
      setSubmitted(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : "حدث خطأ"); }
    finally { setLoading(false); }
  }

  if (submitted) return (
    <section className="form-card success-card">
      <div className="digital-card"><Image src="/images/champions-trophy.jpeg" alt="كأس البطولة" width={180} height={180} /><div><span>تم استلام بياناتك</span><h2>الكابتن {student?.name}</h2><p>فريق أبطال دوري المدارس U13<br/>مدرسة عماد الدين زنكي المتوسطة</p></div></div>
      <CheckCircle2 size={48} />
      <h2>تم إرسال بياناتك بنجاح</h2>
      <p>انتقلت البيانات إلى إدارة المدرسة للمراجعة. يمكنك الدخول لاحقًا برقم الهوية لمعرفة حالة الطلب.</p>
    </section>
  );

  return (
    <>

      {student && showWelcome && (
        <div className="welcome-overlay" role="dialog" aria-modal="true" aria-label="رسالة ترحيب بالبطل">
          <div className="welcome-modal">
            <button className="welcome-close" onClick={() => setShowWelcome(false)} aria-label="إغلاق">×</button>
            <div className="welcome-trophy">
              <Image src="/images/champions-trophy.jpeg" alt="كأس بطل بطولة المدن والمحافظات 2026" fill sizes="(max-width: 700px) 90vw, 430px" priority />
            </div>
            <div className="welcome-copy">
              <span className="welcome-kicker">أهلًا بك</span>
              <h2>بطل المدن والمحافظات</h2>
              <p className="welcome-captain">الكابتن</p>
              <strong>{student.name}</strong>
              <p>يسعدنا تواجدك معنا في رحلة التميز. أكمل بياناتك بدقة لاعتماد مشاركتك واستحقاقك.</p>
              <button className="welcome-action" onClick={() => setShowWelcome(false)}>لنبدأ رحلتنا</button>
            </div>
          </div>
        </div>
      )}
      <section className="form-card">
      <div className="section-heading"><ShieldCheck /><div><span>الخطوة الأولى</span><h2>التحقق من هوية الطالب</h2></div></div>
      <label className="field-label" htmlFor="nationalId">رقم الهوية الوطنية أو الإقامة</label>
      <p className="field-help">أدخل الرقم المكون من 10 أرقام كما هو مسجل في قائمة الفريق.</p>
      <div className="verify-row">
        <input id="nationalId" inputMode="numeric" maxLength={10} value={nationalId} onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ""))} disabled={!!student} placeholder="مثال: 10XXXXXXXX" />
        <button className="primary-button" onClick={verify} disabled={loading || !!student}>{loading ? <Loader2 className="spin" /> : <Search />} تحقق</button>
      </div>
      {message && <div className="alert error">{message}</div>}

      {student && (
        <>
          <div className="verified-card"><BadgeCheck /><div><small>تم التحقق من البيانات</small><strong>{student.name}</strong><span>رقم الهوية: ******{nationalId.slice(-4)}</span></div><button className="icon-button" onClick={() => location.reload()} title="تغيير الهوية"><RotateCcw /></button></div>
          {student.status === "approved" && <div className="alert success">تم اعتماد بياناتك نهائيًا من إدارة المدرسة.</div>}
          {student.status === "pending_review" && <div className="alert info">بياناتك قيد المراجعة حاليًا ولا يمكن تعديلها.</div>}
          {student.status === "returned_for_correction" && <div className="alert warning"><strong>أعيد الطلب للتصحيح:</strong> {student.returnReason}</div>}

          {canEdit && <form onSubmit={submit} className="data-form">
            <div className="section-heading compact"><Building2 /><div><span>الخطوة الثانية</span><h2>بيانات الحساب البنكي</h2></div></div>
            <fieldset>
              <legend>هل الطالب يملك حسابًا بنكيًا باسمه؟</legend>
              <p className="field-help">اختر «نعم» فقط إذا كان اسم الطالب هو صاحب الحساب البنكي.</p>
              <div className="choice-grid">
                <label className={hasAccount === "yes" ? "choice active" : "choice"}><input type="radio" name="account" value="yes" checked={hasAccount === "yes"} onChange={() => setHasAccount("yes")} /><UserRound /><span><strong>نعم</strong><small>الحساب باسم الطالب</small></span></label>
                <label className={hasAccount === "no" ? "choice active" : "choice"}><input type="radio" name="account" value="no" checked={hasAccount === "no"} onChange={() => setHasAccount("no")} /><Building2 /><span><strong>لا</strong><small>الحساب باسم ولي الأمر</small></span></label>
              </div>
            </fieldset>

            {hasAccount === "no" && <div className="conditional-panel">
              <label className="field-label">اسم ولي الأمر رباعيًا</label><p className="field-help">اكتب اسم صاحب الحساب كما يظهر في شهادة الآيبان.</p>
              <input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} required placeholder="الاسم الرباعي لولي الأمر" />
              <label className="field-label">رقم جوال ولي الأمر</label><p className="field-help">رقم الجوال المعتمد لدى المدرسة بصيغة 05XXXXXXXX.</p>
              <input inputMode="tel" value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} required placeholder="05XXXXXXXX" />
            </div>}

            {hasAccount && <>
              <label className="field-label">{hasAccount === "yes" ? "رقم آيبان الطالب" : "رقم آيبان ولي الأمر"}</label>
              <p className="field-help">أدخل الآيبان كاملًا، يبدأ بـ SA ويتكون من 24 خانة. تزال الفراغات تلقائيًا.</p>
              <input dir="ltr" value={iban} onChange={(e) => setIban(e.target.value.toUpperCase())} required placeholder="SA00 0000 0000 0000 0000 0000" />
              <label className="field-label">اسم البنك</label><p className="field-help">اكتب جزءًا من اسم البنك ثم اختره من النتائج الظاهرة.</p>
              <div className="bank-combobox">
                <div className="bank-input-wrap">
                  <input
                    value={bankSearch}
                    onFocus={() => setBankOpen(true)}
                    onChange={(e) => { setBankSearch(e.target.value); setBankName(""); setBankOpen(true); }}
                    onBlur={() => window.setTimeout(() => setBankOpen(false), 150)}
                    placeholder="ابحث عن البنك..."
                    autoComplete="off"
                    aria-autocomplete="list"
                    aria-expanded={bankOpen}
                    required
                  />
                  <ChevronDown aria-hidden="true" />
                </div>
                {bankOpen && <div className="bank-options" role="listbox">
                  {filteredBanks.length ? filteredBanks.map((bank) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={bankName === bank}
                      className={bankName === bank ? "selected" : ""}
                      key={bank}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setBankName(bank); setBankSearch(bank); setBankOpen(false); }}
                    >{bank}</button>
                  )) : <div className="bank-empty">لا توجد نتائج مطابقة</div>}
                </div>}
              </div>
              <label className="field-label">صورة أو شهادة الآيبان</label><p className="field-help">ارفع صورة واضحة أو ملف PDF يظهر اسم صاحب الحساب ورقم الآيبان. سيحاول النظام مقارنة الآيبان بالصورة.</p>
              <label className="upload-zone"><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /><UploadCloud /><strong>{file ? file.name : "اضغط لاختيار الملف"}</strong><span>JPG أو PNG أو WEBP أو PDF — بحد أقصى 8MB</span></label>
              <div className="privacy-note"><FileImage /><span>الملف يحفظ في مساحة خاصة داخل Supabase ولا يظهر إلا للمسؤولين المخولين.</span></div>
              <label className="consent-box"><input type="checkbox" checked={consentAccepted} onChange={(e) => setConsentAccepted(e.target.checked)} required /><span>أقر بصحة البيانات المدخلة وأوافق على استخدامها لغرض تسجيل وصرف مستحقات بطولة دوري المدارس.</span></label>
              <button className="submit-button" type="submit" disabled={loading || !consentAccepted}>{loading ? <><Loader2 className="spin" /> جاري التحقق والإرسال...</> : <><CheckCircle2 /> إرسال البيانات للمراجعة</>}</button>
            </>}
          </form>}
        </>
      )}
      </section>
    </>
  );
}
