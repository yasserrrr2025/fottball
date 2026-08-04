"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { 
  Check, 
  Download, 
  Edit, 
  Eye, 
  FileSpreadsheet, 
  Link2, 
  LogOut, 
  MessageCircle, 
  Plus, 
  RefreshCw, 
  RotateCcw, 
  Search, 
  ShieldCheck, 
  Trash2, 
  Upload, 
  UserPlus, 
  X 
} from "lucide-react";

type Submission = { 
  id: string; 
  status: string; 
  has_student_bank_account: boolean; 
  student_iban: string | null; 
  guardian_name: string | null; 
  guardian_phone: string | null; 
  guardian_iban: string | null; 
  bank_name: string; 
  iban_match_status: string; 
  extracted_iban: string | null; 
  return_reason: string | null; 
  submitted_at: string; 
  consent_accepted: boolean; 
  students: { full_name: string; national_id: string } 
};

type Student = { 
  id: string; 
  full_name: string; 
  national_id: string; 
  is_active: boolean; 
  submissions: { status: string }[] 
};

const labels: Record<string, string> = { 
  pending_review: "بانتظار المراجعة", 
  returned_for_correction: "معاد للتصحيح", 
  approved: "معتمد", 
  rejected: "مرفوض" 
};

export default function AdminDashboard() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const [students, setStudents] = useState<Student[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [tab, setTab] = useState<"requests" | "students">("requests");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  
  const [fullName, setFullName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState<any>(null);

  // إدارة التحديد والتعديل والتقرير للطلاب
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editStudent, setEditStudent] = useState<{ id: string; fullName: string; nationalId: string } | null>(null);
  const [importReport, setImportReport] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (session) loadData();
  }, [session]);

  async function authHeader() {
    const { data } = await supabase.auth.getSession();
    return { authorization: `Bearer ${data.session?.access_token}` };
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setError(error.message || "بيانات الدخول غير صحيحة.");
  }

  async function loadData() {
    setBusy(true);
    const [s, r] = await Promise.all([
      supabase.from("students").select("id,full_name,national_id,is_active,submissions(status)").order("created_at", { ascending: false }),
      supabase.from("submissions").select("id,status,has_student_bank_account,student_iban,guardian_name,guardian_phone,guardian_iban,bank_name,iban_match_status,extracted_iban,return_reason,submitted_at,consent_accepted,students(full_name,national_id)").order("submitted_at", { ascending: false })
    ]);
    if (s.error || r.error) setError("تأكد من تشغيل ملف الترقية وإضافة حسابك في admin_users.");
    setStudents((s.data as any) || []);
    setSubmissions((r.data as any) || []);
    setBusy(false);
  }

  async function addStudent(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/students/manual", {
      method: "POST",
      headers: { "content-type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ fullName, nationalId })
    });
    const j = await res.json();
    if (!res.ok) return setError(j.message);
    setFullName("");
    setNationalId("");
    loadData();
  }

  async function importExcel(file: File) {
    setBusy(true);
    setError("");
    const body = new FormData();
    body.set("file", file);
    try {
      const res = await fetch("/api/admin/students/import", { method: "POST", headers: await authHeader(), body });
      const j = await res.json();
      if (!res.ok) return setError(j.message || "تعذر استيراد ملف Excel");
      setImportReport(j);
      loadData();
    } catch (_e) {
      setError("حدث خطأ أثناء قراءة ملف Excel.");
    } finally {
      setBusy(false);
    }
  }

  async function action(id: string, type: string) {
    let reason = "";
    if (["return", "reject", "reopen"].includes(type)) {
      reason = prompt("اكتب سبب الإجراء:") || "";
      if (!reason) return;
    }
    const res = await fetch(`/api/admin/submissions/${id}/action`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ action: type, reason })
    });
    const j = await res.json();
    if (!res.ok) return alert(j.message);
    await loadData();
    if (type === "approve_next" && j.nextId) openDetails(j.nextId);
  }

  async function deleteSingleStudent(id: string, name: string) {
    if (!confirm(`هل أنت تأكد من حذف الطالب "${name}"؟`)) return;
    const res = await fetch(`/api/admin/students/${id}`, { method: "DELETE", headers: await authHeader() });
    const j = await res.json();
    if (!res.ok) return alert(j.message || "تعذر الحذف");
    setSelectedIds(prev => prev.filter(item => item !== id));
    loadData();
  }

  async function deleteBatchStudents() {
    if (selectedIds.length === 0) return alert("لم يتم تحديد أي طالب للحذف.");
    if (!confirm(`هل أنت تأكد من حذف ${selectedIds.length} طالب المحددين؟`)) return;
    const res = await fetch("/api/admin/students/batch-delete", {
      method: "POST",
      headers: { "content-type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ ids: selectedIds })
    });
    const j = await res.json();
    if (!res.ok) return alert(j.message || "تعذر الحذف");
    setSelectedIds([]);
    loadData();
  }

  async function deleteAllStudents() {
    if (students.length === 0) return alert("القائمة فارغة بالفعل.");
    if (!confirm("⚠️ تحذير: هل أنت تأكد من مسح جميع الطلاب دفعة واحدة؟ لن يمكنك التراجع عن هذا الإجراء.")) return;
    const res = await fetch("/api/admin/students/batch-delete", {
      method: "POST",
      headers: { "content-type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ deleteAll: true })
    });
    const j = await res.json();
    if (!res.ok) return alert(j.message || "تعذر المسح");
    setSelectedIds([]);
    loadData();
  }

  async function handleSaveEditStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!editStudent) return;
    const res = await fetch(`/api/admin/students/${editStudent.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ fullName: editStudent.fullName, nationalId: editStudent.nationalId })
    });
    const j = await res.json();
    if (!res.ok) return alert(j.message || "تعذر تعديل بيانات الطالب");
    setEditStudent(null);
    loadData();
  }

  async function openAttachment(id: string) {
    const res = await fetch(`/api/admin/attachment/${id}`, { headers: await authHeader() });
    const j = await res.json();
    if (j.url) window.open(j.url, "_blank");
  }

  async function openDetails(id: string) {
    const res = await fetch(`/api/admin/submissions/${id}/details`, { headers: await authHeader() });
    const j = await res.json();
    if (res.ok) setDetails(j);
  }

  async function correctionLink(id: string) {
    const res = await fetch(`/api/admin/submissions/${id}/correction-link`, { method: "POST", headers: await authHeader() });
    const j = await res.json();
    if (!res.ok) return alert(j.message);
    await navigator.clipboard.writeText(j.url);
    alert("تم نسخ رابط التصحيح الصالح لمدة 72 ساعة");
  }

  async function notify(s: Submission) {
    const res = await fetch(`/api/admin/submissions/${s.id}/notification`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(await authHeader()) },
      body: "{}"
    });
    const j = await res.json();
    if (!res.ok) return alert(j.message);
    if (j.whatsappUrl) window.open(j.whatsappUrl, "_blank");
    else await navigator.clipboard.writeText(j.message);
  }

  async function exportFile(scope: string) {
    const res = await fetch(`/api/admin/export?scope=${scope}`, { headers: await authHeader() });
    if (!res.ok) return alert("تعذر التصدير");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `football-team-${scope}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!session) return (
    <main className="admin-login">
      <form onSubmit={login} className="login-card">
        <div className="brand-mark">⚽</div>
        <h1>دخول إدارة الفريق</h1>
        <p>استخدم حساب الإدارة المعتمد.</p>
        <label>البريد الإلكتروني</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <label>كلمة المرور</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        {error && <div className="alert error">{error}</div>}
        <button className="primary-button"><ShieldCheck />تسجيل الدخول</button>
      </form>
    </main>
  );

  const counts = {
    total: students.length,
    pending: submissions.filter(s => s.status === "pending_review").length,
    returned: submissions.filter(s => s.status === "returned_for_correction").length,
    approved: submissions.filter(s => s.status === "approved").length
  };
  const pct = Math.min(100, Math.round((counts.approved / 20) * 100));

  const visible = submissions.filter(s => (filter === "all" || s.status === filter) && `${s.students.full_name} ${s.students.national_id}`.includes(search));
  const visibleStudents = students.filter(s => `${s.full_name} ${s.national_id}`.includes(search));

  const allVisibleSelected = visibleStudents.length > 0 && visibleStudents.every(s => selectedIds.includes(s.id));

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(visibleStudents.map(s => s.id));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }

  return (
    <main className="admin-shell">
      <aside className="sidebar">
        <div>
          <div className="sidebar-brand"><span>⚽</span><strong>إدارة الفريق</strong></div>
          <button className={tab === "requests" ? "nav active" : "nav"} onClick={() => setTab("requests")}><ShieldCheck />المراجعة والاعتماد</button>
          <button className={tab === "students" ? "nav active" : "nav"} onClick={() => setTab("students")}><UserPlus />قائمة الطلاب</button>
        </div>
        <button className="nav" onClick={() => supabase.auth.signOut()}><LogOut />تسجيل الخروج</button>
      </aside>

      <section className="admin-content">
        <header className="admin-header">
          <div>
            <p>مدرسة عماد الدين زنكي المتوسطة</p>
            <h1>{tab === "requests" ? "مركز مراجعة اللاعبين" : "إدارة قائمة الطلاب"}</h1>
          </div>
          <div className="admin-actions-bar">
            <button className="secondary-button" onClick={() => exportFile("approved")}><Download />تصدير المعتمدين</button>
            <button className="icon-button" onClick={loadData}><RefreshCw className={busy ? "spin" : ""} /></button>
          </div>
        </header>
        {error && <div className="alert error">{error}</div>}

        <div className="stats">
          <article><span>إجمالي الطلاب</span><strong>{counts.total}</strong></article>
          <article><span>بانتظار المراجعة</span><strong>{counts.pending}</strong></article>
          <article><span>معاد للتصحيح</span><strong>{counts.returned}</strong></article>
          <article><span>معتمد</span><strong>{counts.approved}</strong></article>
        </div>

        <div className="progress-card">
          <strong>اكتمل اعتماد {counts.approved} من 20 لاعبًا — {pct}%</strong>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
        </div>

        <div className="toolbar">
          <div className="search-box">
            <Search />
            <input placeholder="بحث بالاسم أو الهوية" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {tab === "requests" && (
            <select value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="all">جميع الحالات</option>
              <option value="pending_review">بانتظار المراجعة</option>
              <option value="returned_for_correction">معاد للتصحيح</option>
              <option value="approved">معتمد</option>
              <option value="rejected">مرفوض</option>
            </select>
          )}
          {tab === "students" && (
            <div className="admin-actions-bar">
              {selectedIds.length > 0 && (
                <button className="secondary-button danger-btn" onClick={deleteBatchStudents}>
                  <Trash2 size={16} /> حذف المحدد ({selectedIds.length})
                </button>
              )}
              {students.length > 0 && (
                <button className="secondary-button danger-btn" onClick={deleteAllStudents}>
                  <Trash2 size={16} /> مسح كافة الطلاب
                </button>
              )}
            </div>
          )}
        </div>

        {tab === "students" ? (
          <>
            <div className="admin-grid">
              <form className="panel" onSubmit={addStudent}>
                <h2><Plus />إضافة طالب يدويًا</h2>
                <label>اسم الطالب رباعيًا</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)} required />
                <label>رقم الهوية أو الإقامة</label>
                <input inputMode="numeric" maxLength={10} value={nationalId} onChange={e => setNationalId(e.target.value.replace(/\D/g, ""))} required />
                <button className="primary-button"><UserPlus />إضافة الطالب</button>
              </form>
              <div className="panel">
                <h2><FileSpreadsheet />استيراد من Excel</h2>
                <p>الملف يحتوي على اسم الطالب ورقم الهوية، مع معاينة الأخطاء والتكرار قبل الحفظ.</p>
                <label className="upload-zone small">
                  <input type="file" accept=".xlsx,.xls" onChange={e => e.target.files?.[0] && importExcel(e.target.files[0])} />
                  <Upload />
                  <strong>اختر ملف Excel</strong>
                </label>
              </div>
            </div>

            <div className="table-card">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: "center" }}>
                      <input 
                        type="checkbox" 
                        checked={allVisibleSelected} 
                        onChange={toggleSelectAll} 
                      />
                    </th>
                    <th>اسم الطالب</th>
                    <th>رقم الهوية</th>
                    <th>حالة التسجيل</th>
                    <th style={{ textAlign: "center" }}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleStudents.map(s => (
                    <tr key={s.id}>
                      <td style={{ textAlign: "center" }}>
                        <input 
                          type="checkbox" 
                          checked={selectedIds.includes(s.id)} 
                          onChange={() => toggleSelect(s.id)} 
                        />
                      </td>
                      <td><strong>{s.full_name}</strong></td>
                      <td dir="ltr">{s.national_id}</td>
                      <td>{s.submissions?.[0]?.status ? labels[s.submissions[0].status] : "لم يعبئ"}</td>
                      <td>
                        <div className="row-actions" style={{ justifyContent: "center" }}>
                          <button 
                            title="تعديل الطالب" 
                            onClick={() => setEditStudent({ id: s.id, fullName: s.full_name, nationalId: s.national_id })}
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            className="reject" 
                            title="حذف الطالب" 
                            onClick={() => deleteSingleStudent(s.id, s.full_name)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {visibleStudents.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
                        لا يوجد طلاب مضافون في القائمة.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>الطالب</th>
                  <th>الحساب</th>
                  <th>نتائج التحقق</th>
                  <th>الحالة</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(s => (
                  <tr key={s.id}>
                    <td><strong>{s.students.full_name}</strong><small>{s.students.national_id}</small></td>
                    <td>{s.has_student_bank_account ? "الطالب" : `ولي الأمر: ${s.guardian_name}`}</td>
                    <td>
                      <div className="review-flags">
                        <span className={`flag ${s.iban_match_status === "matched" ? "good" : s.iban_match_status === "mismatched" ? "bad" : ""}`}>
                          الصورة: {s.iban_match_status === "matched" ? "مطابق" : s.iban_match_status === "mismatched" ? "غير مطابق" : "يدوي"}
                        </span>
                      </div>
                    </td>
                    <td><span className={`status ${s.status}`}>{labels[s.status]}</span></td>
                    <td>
                      <div className="row-actions">
                        <button title="التفاصيل" onClick={() => openDetails(s.id)}><Eye /></button>
                        <button title="المرفق" onClick={() => openAttachment(s.id)}><FileSpreadsheet /></button>
                        <button title="إشعار واتساب" onClick={() => notify(s)}><MessageCircle /></button>
                        {s.status === "pending_review" && (
                          <>
                            <button className="approve" title="اعتماد" onClick={() => action(s.id, "approve")}><Check /></button>
                            <button className="return" title="إعادة" onClick={() => action(s.id, "return")}><RotateCcw /></button>
                            <button className="reject" title="رفض" onClick={() => action(s.id, "reject")}><X /></button>
                          </>
                        )}
                        {s.status === "returned_for_correction" && (
                          <button title="نسخ رابط تصحيح" onClick={() => correctionLink(s.id)}><Link2 /></button>
                        )}
                        {s.status === "approved" && (
                          <button title="إعادة فتح" onClick={() => action(s.id, "reopen")}><RotateCcw /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* نافذة تقرير استيراد Excel المفصل */}
      {importReport && (
        <div className="details-drawer">
          <div className="details-panel" style={{ maxWidth: 680 }}>
            <button className="welcome-close" onClick={() => setImportReport(null)}>×</button>
            <h2>📊 تقرير استيراد ملف Excel</h2>
            <div className="stats" style={{ margin: "16px 0" }}>
              <article><span>إجمالي الأسطر</span><strong>{importReport.totalRows}</strong></article>
              <article><span>تمت الإضافة بنجاح</span><strong style={{ color: "#86efac" }}>{importReport.importedCount}</strong></article>
              <article><span>صفوف مكررة</span><strong style={{ color: "#fde047" }}>{importReport.duplicates?.length || 0}</strong></article>
              <article><span>مستبعدة / غير صالحة</span><strong style={{ color: "#fca5a5" }}>{importReport.invalid?.length || 0}</strong></article>
            </div>

            {(importReport.invalid?.length > 0 || importReport.duplicates?.length > 0) ? (
              <div style={{ marginTop: 20 }}>
                <h3 style={{ color: "var(--gold-light)", fontSize: 16, marginBottom: 12 }}>تفاصيل الأسطر المستبعدة / المكررة:</h3>
                <div className="table-card" style={{ maxHeight: 260, overflowY: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 60, textAlign: "center" }}>الصف</th>
                        <th>اسم الطالب</th>
                        <th>رقم الهوية</th>
                        <th>سبب الاستبعاد</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importReport.invalid?.map((item: any, idx: number) => (
                        <tr key={`inv-${idx}`}>
                          <td style={{ textAlign: "center" }}>{item.row}</td>
                          <td><strong>{item.full_name}</strong></td>
                          <td dir="ltr">{item.national_id}</td>
                          <td style={{ color: "#fca5a5" }}>{item.reason}</td>
                        </tr>
                      ))}
                      {importReport.duplicates?.map((item: any, idx: number) => (
                        <tr key={`dup-${idx}`}>
                          <td style={{ textAlign: "center" }}>{item.row}</td>
                          <td><strong>{item.full_name}</strong></td>
                          <td dir="ltr">{item.national_id}</td>
                          <td style={{ color: "#fde047" }}>{item.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="alert success" style={{ marginTop: 16 }}>
                تم استيراد كافة أسطر الملف بنجاح دون أي استبعاد!
              </div>
            )}

            <div className="admin-actions-bar" style={{ marginTop: 24, justifyContent: "flex-end" }}>
              <button className="primary-button" onClick={() => setImportReport(null)}>إغلاق التقرير</button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تعديل بيانات طالب */}
      {editStudent && (
        <div className="details-drawer">
          <div className="details-panel" style={{ maxWidth: 500 }}>
            <button className="welcome-close" onClick={() => setEditStudent(null)}>×</button>
            <h2><Edit /> تعديل بيانات الطالب</h2>
            <form onSubmit={handleSaveEditStudent} style={{ marginTop: 18 }}>
              <label className="field-label">اسم الطالب رباعيًا</label>
              <input 
                value={editStudent.fullName} 
                onChange={e => setEditStudent({ ...editStudent, fullName: e.target.value })} 
                required 
              />

              <label className="field-label">رقم الهوية الوطنية أو الإقامة</label>
              <input 
                inputMode="numeric" 
                maxLength={10} 
                value={editStudent.nationalId} 
                onChange={e => setEditStudent({ ...editStudent, nationalId: e.target.value.replace(/\D/g, "") })} 
                required 
              />

              <div className="admin-actions-bar" style={{ marginTop: 24, justifyContent: "flex-end" }}>
                <button type="button" className="secondary-button" onClick={() => setEditStudent(null)}>إلغاء</button>
                <button type="submit" className="primary-button"><Check /> حفظ التغييرات</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة التفاصيل */}
      {details && (
        <div className="details-drawer">
          <div className="details-panel">
            <button className="welcome-close" onClick={() => setDetails(null)}>×</button>
            <h2>مراجعة طلب {details.submission.students.full_name}</h2>
            <div className="details-grid">
              <div className="detail-box"><small>الآيبان المدخل</small><strong dir="ltr">{details.submission.student_iban || details.submission.guardian_iban}</strong></div>
              <div className="detail-box"><small>الآيبان المستخرج</small><strong dir="ltr">{details.submission.extracted_iban || "تعذر الاستخراج"}</strong></div>
              <div className="detail-box"><small>اسم البنك</small><strong>{details.submission.bank_name}</strong></div>
              <div className="detail-box"><small>الإقرار</small><strong>{details.submission.consent_accepted ? "موافق" : "غير مسجل"}</strong></div>
            </div>
            <div className="admin-actions-bar" style={{ marginTop: 18 }}>
              <button className="secondary-button" onClick={() => openAttachment(details.submission.id)}><Eye />فتح المرفق</button>
              {details.submission.status === "pending_review" && (
                <button className="primary-button" onClick={() => action(details.submission.id, "approve_next")}><Check />اعتماد والانتقال للتالي</button>
              )}
            </div>
            <h3>سجل الإجراءات</h3>
            <div className="audit-list">
              {details.audit.map((a: any) => (
                <div className="audit-item" key={a.id}>
                  <strong>{a.action}</strong>
                  <div>{a.reason || "دون ملاحظة"}</div>
                  <small>{new Date(a.created_at).toLocaleString("ar-SA")}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
