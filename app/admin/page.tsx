"use client";

import { useMemo, useState } from "react";

type Payment = { id:number; user:string; plan:string; amount:string; status:"معلق"|"مدفوع"|"مرفوض"; date:string };
type News = { id:number; title:string; body:string; published:boolean };

const seedPayments:Payment[] = [
  {id:1,user:"أحمد سالم",plan:"اشتراك شهري",amount:"10 د.ل",status:"معلق",date:"2026-10-04"},
  {id:2,user:"محمد علي",plan:"اشتراك شهري",amount:"10 د.ل",status:"مدفوع",date:"2026-10-03"},
  {id:3,user:"سارة محمود",plan:"اشتراك سنوي",amount:"100 د.ل",status:"مرفوض",date:"2026-10-02"}
];

export default function AdminPage(){
  const [tab,setTab]=useState("overview");
  const [payments,setPayments]=useState(seedPayments);
  const [news,setNews]=useState<News[]>([]);
  const [primary,setPrimary]=useState("#1aa8b9");
  const [bg,setBg]=useState("#06111d");
  const [newTitle,setNewTitle]=useState("");
  const [newBody,setNewBody]=useState("");
  const [notice,setNotice]=useState("وضع الإدارة التجريبي — سيتم ربط البيانات الحقيقية والحسابات بعد تفعيل قاعدة البيانات.");
  const revenue=useMemo(()=>payments.filter(p=>p.status==="مدفوع").reduce((s,p)=>s+Number(p.amount.replace(/[^0-9.]/g,"")),0),[payments]);

  function addNews(){
    if(!newTitle.trim()) return;
    setNews(n=>[{id:Date.now(),title:newTitle.trim(),body:newBody.trim(),published:true},...n]);
    setNewTitle(""); setNewBody("");
  }
  function paymentStatus(id:number,status:Payment["status"]){setPayments(p=>p.map(x=>x.id===id?{...x,status}:x));}

  return <main className="admin-shell" style={{"--admin-bg":bg,"--admin-primary":primary} as React.CSSProperties} dir="rtl">
    <aside className="admin-sidebar">
      <div className="admin-brand"><div className="brand-mark">SA</div><div><strong>Sailing AI</strong><span>لوحة التحكم</span></div></div>
      <nav>
        {[
          ["overview","نظرة عامة"],["payments","المدفوعات"],["content","الأخبار والمحتوى"],["appearance","الألوان والمظهر"],["users","المستخدمون والصلاحيات"]
        ].map(([id,label])=><button className={tab===id?"selected":""} onClick={()=>setTab(id)} key={id}>{label}</button>)}
      </nav>
      <div className="admin-note">{notice}</div>
    </aside>

    <section className="admin-main">
      <header className="admin-header"><div><span className="eyebrow">SAILING AI • ADMIN</span><h1>{tab==="overview"?"لوحة الإدارة":tab==="payments"?"المدفوعات":tab==="content"?"الأخبار والمحتوى":tab==="appearance"?"المظهر والألوان":"المستخدمون والصلاحيات"}</h1></div><a href="/" className="back-link">← الموقع</a></header>

      {tab==="overview" && <div className="admin-content">
        <div className="stat-grid"><Stat title="الإيرادات" value={revenue+" د.ل"} /><Stat title="طلبات معلقة" value={payments.filter(p=>p.status==="معلق").length.toString()} /><Stat title="المدفوعات" value={payments.length.toString()} /><Stat title="مدة التجربة" value="30 يوم" /></div>
        <div className="admin-card"><h2>خطة التشغيل</h2><p>كل مستخدم جديد يحصل على شهر مجاني، ثم تظهر له صفحة الاشتراك والدفع. يستطيع المدير تمديد التجربة، تفعيل الاشتراك، إيقاف الحساب أو فتح صلاحية مدير.</p><div className="pill-row"><span>تجربة 30 يوم</span><span>اشتراك شهري</span><span>د.ل</span><span>صلاحيات مدير</span></div></div>
        <div className="admin-card"><h2>آخر المدفوعات</h2><PaymentTable payments={payments} onStatus={paymentStatus}/></div>
      </div>}

      {tab==="payments" && <div className="admin-content"><div className="admin-card"><div className="card-head"><div><h2>إدارة المدفوعات</h2><p>مراجعة الطلبات وتأكيد الدفع أو رفضه.</p></div><button className="primary">إضافة خطة</button></div><PaymentTable payments={payments} onStatus={paymentStatus}/></div><div className="admin-card"><h2>إعدادات الدفع</h2><div className="form-grid"><label>سعر الشهر<input defaultValue="10" /></label><label>مدة التجربة<input defaultValue="30" /></label><label>العملة<select defaultValue="LYD"><option value="LYD">دينار ليبي (LYD)</option></select></label><label>طريقة الدفع<select defaultValue="manual"><option value="manual">تحويل/بطاقة مصرفية — مراجعة يدوية</option><option value="gateway">بوابة دفع — عند ربط المزود</option></select></label></div></div></div>}

      {tab==="content" && <div className="admin-content"><div className="admin-card"><h2>إضافة خبر أو ملاحظة</h2><div className="form-grid"><label>العنوان<input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="عنوان الخبر" /></label><label>المحتوى<textarea value={newBody} onChange={e=>setNewBody(e.target.value)} placeholder="اكتب الخبر أو الملاحظة..." /></label></div><button className="primary" onClick={addNews}>نشر</button></div><div className="admin-card"><h2>الأخبار المنشورة</h2>{news.length===0?<p className="muted">لا توجد أخبار بعد.</p>:news.map(n=><article className="news-row" key={n.id}><div><b>{n.title}</b><p>{n.body}</p></div><span>منشور</span></article>)}</div></div>}

      {tab==="appearance" && <div className="admin-content"><div className="admin-card"><h2>ألوان الموقع</h2><p>غيّر لون الخلفية واللون الأساسي ثم احفظهما في إعدادات الموقع.</p><div className="color-grid"><label>الخلفية<input type="color" value={bg} onChange={e=>setBg(e.target.value)}/><code>{bg}</code></label><label>اللون الأساسي<input type="color" value={primary} onChange={e=>setPrimary(e.target.value)}/><code>{primary}</code></label></div><div className="preview" style={{background:bg}}><div style={{background:primary}} className="preview-button">معاينة</div><span>هذه معاينة مباشرة للواجهة.</span></div></div></div>}

      {tab==="users" && <div className="admin-content"><div className="admin-card"><h2>المستخدمون والصلاحيات</h2><p>بعد ربط Supabase، ستتم إدارة الأدوار عبر صلاحيات آمنة في قاعدة البيانات وليس من المتصفح.</p><div className="user-row"><div><b>مالك الموقع</b><span>المدير الرئيسي</span></div><strong>OWNER</strong></div><div className="user-row"><div><b>مستخدم جديد</b><span>تجربة مجانية حتى 30 يوماً</span></div><button className="secondary">فتح صلاحية مدير</button></div><div className="user-row"><div><b>مدير محتوى</b><span>إدارة الأخبار والملاحظات</span></div><button className="secondary">تعديل الصلاحية</button></div></div></div>}
    </section>
  </main>
}

function Stat({title,value}:{title:string,value:string}){return <div className="stat"><span>{title}</span><b>{value}</b></div>}
function PaymentTable({payments,onStatus}:{payments:Payment[],onStatus:(id:number,status:Payment["status"])=>void}){return <div className="table-wrap"><table><thead><tr><th>المستخدم</th><th>الخطة</th><th>المبلغ</th><th>التاريخ</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>{payments.map(p=><tr key={p.id}><td>{p.user}</td><td>{p.plan}</td><td>{p.amount}</td><td>{p.date}</td><td><span className={"status-pill "+p.status}>{p.status}</span></td><td><button className="tiny" onClick={()=>onStatus(p.id,"مدفوع")}>تأكيد</button><button className="tiny danger" onClick={()=>onStatus(p.id,"مرفوض")}>رفض</button></td></tr>)}</tbody></table></div>}
