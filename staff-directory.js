import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';
const db=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const grid=document.querySelector('#staffDirectory');
if(grid){
 const status=document.querySelector('#staffDirectoryStatus');
 const {data,error}=await db.from('staff_directory').select('full_name,job_title,duties,photo_path').eq('is_published',true).order('sort_order',{ascending:true}).order('full_name');
 if(error){status.textContent='Staff profiles are temporarily unavailable.';}
 else if(!data.length){status.textContent='Team profiles will be published here as they become available.';}
 else{
  status.hidden=true;
  const {data:bucket}=db.storage.from('staff-photos').getPublicUrl('placeholder');
  const origin=new URL(bucket.publicUrl).origin;
  for(const staff of data){
   const card=document.createElement('article');card.className='staff-card';
   if(staff.photo_path){
    const url=db.storage.from('staff-photos').getPublicUrl(staff.photo_path).data.publicUrl;
    if(new URL(url).origin===origin){const img=document.createElement('img');img.src=url;img.alt='Portrait of '+staff.full_name;img.loading='lazy';card.append(img);}
   }
   const body=document.createElement('div');body.className='staff-card-body';
   for(const [tag,value] of [['h3',staff.full_name],['strong',staff.job_title],['p',staff.duties]]){
    const el=document.createElement(tag);el.textContent=value;body.append(el);
   }
   card.append(body);grid.append(card);
  }
 }
}
