import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './supabase-config.js';
const db=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=s=>document.querySelector(s);
const msg=s=>{$('#employeeMessage').textContent=s;};
const money=n=>new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN'}).format(Number(n)||0);
const date=d=>d?new Date(d).toLocaleDateString('en-NG'):'—';
async function render(){
 const {data:{user},error:authError}=await db.auth.getUser();
 if(authError||!user){$('#employeeLogin').hidden=false;$('#employeeDashboard').hidden=true;return;}
 const {data:profile,error}=await db.from('employee_profiles').select('full_name,job_title,department,active').eq('user_id',user.id).maybeSingle();
 if(error||!profile||!profile.active){$('#employeeLogin').hidden=false;$('#employeeDashboard').hidden=true;msg('Your account is not yet linked to an active employee profile. Contact TW&D administration.');return;}
 const result=await db.from('salary_payments').select('pay_period,gross_amount,deductions,net_amount,payment_status,paid_at').eq('employee_id',user.id).order('pay_period',{ascending:false});
 if(result.error){msg('Unable to load salary history. Please try again later.');return;}
 $('#employeeLogin').hidden=true;$('#employeeDashboard').hidden=false;msg('');
 $('#employeeName').textContent=profile.full_name;
 $('#employeeRole').textContent=[profile.job_title,profile.department].filter(Boolean).join(' • ');
 const payments=result.data||[],paid=payments.filter(p=>p.payment_status==='paid');
 $('#paymentCount').textContent=String(payments.length);
 $('#paidTotal').textContent=money(paid.reduce((n,p)=>n+Number(p.net_amount),0));
 $('#latestPeriod').textContent=payments[0]?.pay_period||'No records';
 const rows=$('#salaryRows');rows.replaceChildren();
 if(!payments.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.textContent='No salary records have been published for your account yet.';tr.append(td);rows.append(tr);}
 for(const p of payments){const tr=document.createElement('tr');for(const v of [p.pay_period,money(p.gross_amount),money(p.deductions),money(p.net_amount),p.payment_status,date(p.paid_at)]){const td=document.createElement('td');td.textContent=v;tr.append(td);}rows.append(tr);}
}
$('#employeeLoginForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const {error}=await db.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(error)msg('Sign in failed. Check your details or contact administration.');else await render();});
$('#employeeLogout').addEventListener('click',async()=>{await db.auth.signOut();await render();});
$('#resetPassword').addEventListener('click',async()=>{const email=$('#employeeLoginForm').elements.email.value.trim();if(!email){msg('Enter your email address first.');return;}const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:new URL('employee-dashboard.html',location.href).href});msg(error?'Unable to send reset email. Contact administration.':'If the address is registered, a reset email will be sent.');});
await render();
