import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';
const db=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=s=>document.querySelector(s), msg=t=>{$('#adminMessage').textContent=t;};
const form=$('#staffForm');let records=[];
async function refresh(){
 const {data,error}=await db.from('staff_directory').select('*').order('sort_order').order('full_name');
 if(error){msg('Cannot load profiles: '+error.message);return;}
 records=data;const list=$('#staffAdminList');list.replaceChildren();
 for(const row of records){
  const item=document.createElement('div');item.className='staff-admin-row';
  const label=document.createElement('span');label.textContent=row.full_name+' — '+row.job_title+(row.is_published?' (Published)':' (Draft)');
  const edit=document.createElement('button');edit.textContent='Edit';edit.type='button';edit.addEventListener('click',()=>{
   for(const key of ['id','full_name','job_title','duties','sort_order'])form.elements[key].value=row[key]??'';
   form.elements.is_published.checked=row.is_published;form.elements.photo.value='';form.scrollIntoView({behavior:'smooth'});
  });
  const del=document.createElement('button');del.textContent='Delete';del.type='button';del.addEventListener('click',async()=>{
   if(!confirm('Delete the profile for '+row.full_name+'?'))return;
   const {error}=await db.from('staff_directory').delete().eq('id',row.id);
   if(error)msg(error.message);else{msg('Profile deleted.');await refresh();}
  });
  item.append(label,edit,del);list.append(item);
 }
}
async function checkSession(){
 const {data:{user}}=await db.auth.getUser();
 if(!user){$('#loginPanel').hidden=false;$('#editorPanel').hidden=true;return;}
 const {data,error}=await db.from('staff_directory_admins').select('user_id').eq('user_id',user.id).maybeSingle();
 // staff_directory_admins is deliberately not readable by browser clients.
 // Instead test authorization by querying the private (unpublished) records:
 const probe=await db.from('staff_directory').select('id').eq('is_published',false).limit(1);
 // A separate RPC is used below for reliable admin checks.
 const auth=await db.rpc('is_staff_directory_admin');
 const ok=!auth.error&&auth.data===true;
 $('#loginPanel').hidden=ok;$('#editorPanel').hidden=!ok;
 msg(ok?'Signed in as authorised staff administrator.':'This account does not have staff administration permission.');
 if(ok)await refresh();
}
$('#loginForm').addEventListener('submit',async e=>{
 e.preventDefault();const fd=new FormData(e.currentTarget);
 const {error}=await db.auth.signInWithPassword({email:fd.get('email'),password:fd.get('password')});
 if(error)msg('Sign-in failed: '+error.message);else await checkSession();
});
$('#logout').addEventListener('click',async()=>{await db.auth.signOut();form.reset();await checkSession();});
form.addEventListener('submit',async e=>{
 e.preventDefault();const fd=new FormData(form),photo=fd.get('photo');let photo_path;
 const existing=records.find(x=>x.id===fd.get('id'));
 if(photo instanceof File&&photo.size){
  if(photo.size>5242880||!['image/jpeg','image/png','image/webp'].includes(photo.type)){msg('Choose a JPG, PNG or WebP image under 5 MB.');return;}
  const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[photo.type];
  photo_path=crypto.randomUUID()+'.'+ext;
  const upload=await db.storage.from('staff-photos').upload(photo_path,photo,{upsert:false,contentType:photo.type});
  if(upload.error){msg('Photo upload failed: '+upload.error.message);return;}
 }
 const payload={full_name:String(fd.get('full_name')).trim(),job_title:String(fd.get('job_title')).trim(),duties:String(fd.get('duties')).trim(),sort_order:Number(fd.get('sort_order'))||0,is_published:fd.has('is_published'),photo_path:photo_path??existing?.photo_path??null};
 const result=existing?await db.from('staff_directory').update(payload).eq('id',existing.id):await db.from('staff_directory').insert(payload);
 if(result.error){msg('Save failed: '+result.error.message);return;}
 msg('Staff profile saved. Published profiles will appear on About Us.');form.reset();await refresh();
});
form.addEventListener('reset',()=>{form.elements.id.value='';});
await checkSession();
