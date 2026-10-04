"use client";
import { useEffect,useState } from "react";
import { supabase } from "@/lib/supabase";

type Payment={id:string;amount:number;currency:string;plan_code:string;status:string;created_at:string};
type Profile={id:string;display_name:string|null;role:"user"|"content_manager"|"admin"|"owner"};

export default function AdminPage(){
 const [loading,setLoading]=useState(true),[allowed,setAllowed]=useState(false),[tab,setTab]=useState("overview"),[msg,setMsg]=useState("");
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[loginBusy,setLoginBusy]=useState(false),[loginMode,setLoginMode]=useState(false);
 const [payments,setPayments]=useState<Payment[]>([]),[profiles,setProfiles]=useState<Profile[]>([]);
 const [bg,setBg]=useState("#06111d"),[primary,setPrimary]=useState("#1aa8b9"),[price,setPrice]=useState("10"),[trial,setTrial]=useState("30");
 const [bank,setBank]=useState<any>(null),[bankBusy,setBankBusy]=useState(false);
 useEffect(()=>{load()},[]);
 async function load(){
  setLoading(true);
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){setLoginMode(true);setLoading(false);return}
  const {data:p}=await supabase.from("profiles").select("role").eq("id",user.id).single();
  if(!p||!["admin","owner"].includes(p.role)){setMsg("لا تملك صلاحية الوصول إلى لوحة الإدارة.");setLoading(false);return}
  setAllowed(true);
  const [pay,users,settings]=await Promise.all([
   supabase.from("payments").select("*").order("created_at",{ascending:false}),
   supabase.from("profiles").select("id,display_name,role").order("created_at",{ascending:false}),
   supabase.from("site_settings").select("*").eq("id",true).single(),
   supabase.from("bank_accounts").select("*").order("display_order").limit(1).maybeSingle()
  ]);
  if(pay.data)setPayments(pay.data);
  if(users.data)setProfiles(users.data);
  if(settings.data){setBg(settings.data.background_color);setPrimary(settings.data.primary_color);setPrice(String(settings.data.monthly_price));setTrial(String(settings.data.trial_days))}
  if(bank.data)setBank(bank.data);
  setLoading(false);
 }
 async function login(){
  if(loginBusy)return;
  setMsg("");
  if(!email.trim()||!password){setMsg("أدخل البريد الإلكتروني وكلمة المرور.");return}
  setLoginBusy(true);
  const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
  if(error){setMsg(error.message==="Invalid login credentials"?"البريد الإلكتروني أو كلمة المرور غير صحيحة.":error.message);setLoginBusy(false);return}
  setLoginMode(false);
  await load();
  setLoginBusy(false);
 }
 async function logout(){
  await supabase.auth.signOut();
  setAllowed(false);setLoginMode(true);setPayments([]);setProfiles([]);
 }
 async function payment(id:string,status:"paid"|"rejected"){
  const {data:{user}}=await supabase.auth.getUser();if(!user)return;
  const {error}=await supabase.from("payments").update({status,reviewed_by:user.id,reviewed_at:new Date().toISOString()}).eq("id",id);
  if(error)setMsg(error.message);else setPayments(x=>x.map(p=>p.id===id?{...p,status}:p));
 }
 async function saveBank(){
  if(bankBusy||!bank)return; setBankBusy(true); setMsg("");
  const {error}=await supabase.from("bank_accounts").update({bank_name:bank.bank_name,account_name:bank.account_name,account_number:bank.account_number,iban:bank.iban,branch:bank.branch,instructions:bank.instructions,is_active:!!bank.is_active,updated_at:new Date().toISOString()}).eq("id",bank.id);
  setMsg(error?error.message:"تم حفظ بيانات التحويل البنكي بنجاح."); setBankBusy(false);
 }
 async function save(){
  const {error}=await supabase.from("site_settings").update({background_color:bg,primary_color:primary,monthly_price:Number(price)||10,trial_days:Number(trial)||30,updated_at:new Date().toISOString()}).eq("id",true);
  setMsg(error?error.message:"تم حفظ الإعدادات.");
 }
 async function role(id:string,value:Profile["role"]){
  const {error}=await supabase.from("profiles").update({role:value}).eq("id",id);
  if(error)setMsg(error.message);else setProfiles(x=>x.map(p=>p.id===id?{...p,role:value}:p));
 }
 if(loading)return <div className="admin-loading">جارٍ التحقق من صلاحية المدير…</div>;
 if(loginMode)return <main className="admin-login" dir="rtl"><div className="admin-login-card"><div className="admin-brand"><div className="brand-mark">SA</div><div><strong>Sailing AI</strong><span>تسجيل دخول الإدارة</span></div></div><h1>تسجيل الدخول</h1><p>أدخل حساب المدير للوصول إلى لوحة الإدارة.</p>{msg&&<div className="admin-alert">{msg}</div>}<label>البريد الإلكتروني<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@example.com" onKeyDown={e=>{if(e.key==="Enter")login()}}/></label><label>كلمة المرور<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e=>{if(e.key==="Enter")login()}}/></label><button className="primary login-button" onClick={login} disabled={loginBusy}>{loginBusy?"جارٍ الدخول…":"دخول لوحة الإدارة"}</button><a href="/" className="back-link">← العودة للموقع</a></div></main>;
 if(!allowed)return <div className="admin-denied" dir="rtl"><h1>لوحة الإدارة محمية</h1><p>{msg||"هذا الحساب ليس مديراً. استخدم حساب admin أو owner."}</p><button className="primary" onClick={()=>{setMsg("");setLoginMode(true)}}>تسجيل الدخول بحساب آخر</button><a href="/">العودة للموقع</a></div>;
 const revenue=payments.filter(p=>p.status==="paid").reduce((s,p)=>s+Number(p.amount),0);
 return <main className="admin-shell" style={{"--admin-bg":bg,"--admin-primary":primary} as React.CSSProperties} dir="rtl">
  <aside className="admin-sidebar"><div className="admin-brand"><div className="brand-mark">SA</div><div><strong>Sailing AI</strong><span>لوحة التحكم</span></div></div>
  <nav>{[["overview","نظرة عامة"],["payments","المدفوعات"],["bank","بيانات التحويل"],["appearance","الألوان والمظهر"],["users","المستخدمون والصلاحيات"]].map(([id,label])=><button key={id} className={tab===id?"selected":""} onClick={()=>setTab(id)}>{label}</button>)}</nav>
  <div className="admin-note">صلاحيات الإدارة محمية بقاعدة البيانات وRLS.</div></aside>
  <section className="admin-main"><header className="admin-header"><div><span className="eyebrow">SAILING AI • ADMIN</span><h1>{tab==="overview"?"لوحة الإدارة":tab==="payments"?"المدفوعات":tab==="bank"?"بيانات التحويل البنكي":tab==="appearance"?"المظهر والألوان":"المستخدمون والصلاحيات"}</h1></div><div className="admin-header-actions"><button className="logout-button" onClick={logout}>تسجيل الخروج</button><a href="/" className="back-link">← الموقع</a></div></header>
  {msg&&<div className="admin-alert">{msg}</div>}
  {tab==="overview"&&<div className="admin-content"><div className="stat-grid"><Stat title="الإيرادات" value={revenue+" د.ل"}/><Stat title="معلقة" value={String(payments.filter(p=>p.status==="pending").length)}/><Stat title="المدفوعات" value={String(payments.length)}/><Stat title="التجربة" value={trial+" يوم"}/></div><div className="admin-card"><h2>النظام متصل</h2><p>البيانات المعروضة الآن من Supabase وليست بيانات تجريبية.</p></div><PaymentTable payments={payments} onStatus={payment}/></div>}
  {tab==="payments"&&<div className="admin-content"><div className="admin-card"><h2>المدفوعات</h2><PaymentTable payments={payments} onStatus={payment}/></div><div className="admin-card"><h2>الاشتراك</h2><label>السعر الشهري<input value={price} onChange={e=>setPrice(e.target.value)}/></label><label>مدة التجربة<input value={trial} onChange={e=>setTrial(e.target.value)}/></label><button className="primary" onClick={save}>حفظ</button></div></div>}
  {tab==="bank"&&<div className="admin-content"><div className="admin-card"><h2>بيانات الشراء والتحويل البنكي</h2><p>هذه البيانات تظهر للمستخدم عند الضغط على «ترقية» لإتمام التحويل وتسجيل الدفع.</p>{bank?<><label>اسم المصرف<input value={bank.bank_name||""} onChange={e=>setBank({...bank,bank_name:e.target.value})}/></label><label>اسم صاحب الحساب<input value={bank.account_name||""} onChange={e=>setBank({...bank,account_name:e.target.value})}/></label><label>رقم الحساب<input value={bank.account_number||""} onChange={e=>setBank({...bank,account_number:e.target.value})}/></label><label>IBAN<input value={bank.iban||""} onChange={e=>setBank({...bank,iban:e.target.value})}/></label><label>الفرع<input value={bank.branch||""} onChange={e=>setBank({...bank,branch:e.target.value})}/></label><label>تعليمات التحويل<textarea value={bank.instructions||""} onChange={e=>setBank({...bank,instructions:e.target.value})}/></label><label><input type="checkbox" checked={!!bank.is_active} onChange={e=>setBank({...bank,is_active:e.target.checked})}/> الحساب نشط ويظهر للمستخدمين</label><button className="primary" onClick={saveBank} disabled={bankBusy}>{bankBusy?"جارٍ الحفظ…":"حفظ بيانات التحويل"}</button></>:<p>لا يوجد حساب بنكي. أضف حساباً من قاعدة البيانات أولاً.</p>}</div></div>}
  {tab==="appearance"&&<div className="admin-content"><div className="admin-card"><h2>ألوان الموقع</h2><label>الخلفية<input type="color" value={bg} onChange={e=>setBg(e.target.value)}/></label><label>اللون الأساسي<input type="color" value={primary} onChange={e=>setPrimary(e.target.value)}/></label><div className="preview" style={{background:bg}}><div style={{background:primary}} className="preview-button">معاينة</div></div><button className="primary" onClick={save}>حفظ الألوان</button></div></div>}
  {tab==="users"&&<div className="admin-content"><div className="admin-card"><h2>المستخدمون والصلاحيات</h2>{profiles.map(p=><div className="user-row" key={p.id}><div><b>{p.display_name||"مستخدم"}</b><span>{p.id}</span></div><select value={p.role} onChange={e=>role(p.id,e.target.value as Profile["role"])}><option value="user">مستخدم</option><option value="content_manager">مدير محتوى</option><option value="admin">مدير</option><option value="owner">مالك</option></select></div>)}</div></div>}
  </section></main>
}
function Stat({title,value}:{title:string,value:string}){return <div className="stat"><span>{title}</span><b>{value}</b></div>}
function PaymentTable({payments,onStatus}:{payments:Payment[],onStatus:(id:string,status:"paid"|"rejected")=>void}){return <div className="admin-card"><div className="table-wrap"><table><thead><tr><th>المبلغ</th><th>الخطة</th><th>التاريخ</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>{payments.map(p=><tr key={p.id}><td>{p.amount} {p.currency}</td><td>{p.plan_code}</td><td>{new Date(p.created_at).toLocaleDateString("ar-LY")}</td><td>{p.status}</td><td>{p.status==="pending"&&<><button className="tiny" onClick={()=>onStatus(p.id,"paid")}>تأكيد</button><button className="tiny danger" onClick={()=>onStatus(p.id,"rejected")}>رفض</button></>}</td></tr>)}</tbody></table></div></div>}