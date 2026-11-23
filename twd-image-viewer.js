/* TW&D site-wide image viewer: tap any content photo to inspect and download it. */
(function(){
  if(window.__twdImageViewerReady) return;
  window.__twdImageViewerReady=true;
  var style=document.createElement('style');
  style.textContent=`
    img:not(.twd-viewer-image){transition:filter .25s ease,box-shadow .25s ease}
    img.twd-viewer-image{cursor:zoom-in;filter:contrast(1.045) saturate(1.035);border-radius:inherit;box-shadow:0 7px 22px rgba(4,24,52,.16)}
    img.twd-viewer-image:hover{filter:contrast(1.09) saturate(1.12);box-shadow:0 13px 32px rgba(4,24,52,.25)}
    .twd-image-modal{position:fixed;inset:0;z-index:1000000;display:none;align-items:center;justify-content:center;padding:22px;background:rgba(2,10,24,.94);backdrop-filter:blur(9px)}
    .twd-image-modal[open]{display:flex}
    .twd-image-dialog{position:relative;display:flex;flex-direction:column;align-items:center;gap:13px;width:min(1100px,100%);max-height:94vh}
    .twd-image-dialog img{display:block;max-width:100%;max-height:76vh;width:auto;height:auto;object-fit:contain;border-radius:12px;box-shadow:0 24px 80px rgba(0,0,0,.48);background:#101b2a}
    .twd-image-caption{color:#fff;font:600 14px/1.4 Inter,Arial,sans-serif;text-align:center}
    .twd-image-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
    .twd-image-actions a,.twd-image-actions button{border:1px solid rgba(255,255,255,.55);border-radius:999px;padding:11px 18px;background:#0755dd;color:#fff;text-decoration:none;font:800 13px Inter,Arial,sans-serif;cursor:pointer}
    .twd-image-actions button{background:rgba(255,255,255,.12)}
    .twd-image-close{position:absolute;top:-7px;right:0;z-index:2;width:43px;height:43px;border:1px solid #fff;border-radius:50%;background:#071f45;color:#fff;font-size:25px;cursor:pointer}
    @media(max-width:600px){.twd-image-modal{padding:12px}.twd-image-dialog img{max-height:70vh}.twd-image-close{top:-8px;right:0}}
    @media(prefers-reduced-motion:reduce){img.twd-viewer-image{transition:none}}
  `;
  document.head.appendChild(style);
  var modal=document.createElement('div');
  modal.className='twd-image-modal';
  modal.setAttribute('role','dialog');
  modal.setAttribute('aria-modal','true');
  modal.setAttribute('aria-label','Image preview and download');
  modal.innerHTML='<div class="twd-image-dialog"><button class="twd-image-close" type="button" aria-label="Close image preview">×</button><img alt=""><div class="twd-image-caption"></div><div class="twd-image-actions"><a class="twd-image-download" href="#" download>Download image</a><button class="twd-image-close-secondary" type="button">Close preview</button></div></div>';
  document.body.appendChild(modal);
  var preview=modal.querySelector('img'),caption=modal.querySelector('.twd-image-caption'),download=modal.querySelector('.twd-image-download');
  var lastFocus=null;
  function close(){modal.removeAttribute('open');preview.removeAttribute('src');if(lastFocus&&lastFocus.focus)lastFocus.focus();}
  function open(img){
    var src=img.currentSrc||img.src;
    if(!src||src.indexOf('data:')===0)return;
    lastFocus=document.activeElement;
    preview.src=src;preview.alt=img.alt||'TW&D website image';
    caption.textContent=img.alt||'TW&D Engineering image';
    download.href=src;
    var path=src.split('/').pop().split('?')[0]||'twd-image';
    download.setAttribute('download',path);
    modal.setAttribute('open','');
    modal.querySelector('.twd-image-close').focus();
  }
  document.addEventListener('click',function(event){
    var img=event.target.closest('img');
    if(!img||img.closest('.twd-image-modal')||img.hasAttribute('data-no-image-view')||img.closest('[data-no-image-view]'))return;
    if(img.closest('a'))event.preventDefault();
    event.stopPropagation();
    open(img);
  },true);
  modal.querySelectorAll('.twd-image-close,.twd-image-close-secondary').forEach(function(button){button.addEventListener('click',close);});
  modal.addEventListener('click',function(event){if(event.target===modal)close();});
  document.addEventListener('keydown',function(event){if(modal.hasAttribute('open')&&event.key==='Escape')close();});
})();
