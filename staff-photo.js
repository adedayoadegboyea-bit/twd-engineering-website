const maxInputBytes = 25 * 1024 * 1024;
const maxPortraitSide = 1600;
const legacyImageExtension = /\.(tif|tiff|psd|tga|dds|jxl|jp2|j2k|pbm|pgm|ppm|pcx)$/i;
const videoExtension = /\.(mp4|m4v|mov|webm|mpg|mpeg|mpe|m1v|m2v|mpeg4|avi|mkv|wmv|3gp|3g2|mts|m2ts|ogv|vob)$/i;
const jpegType = 'image/jpeg';
const ffmpegSource = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js';
const ffmpegCore = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core';

function readMedia(media, url, readyEvent, timeout, signal) {
  return new Promise((resolve, reject) => {
    const finish = error => {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancelled);
      media.removeEventListener(readyEvent, ready);
      media.removeEventListener('error', failed);
      if (error) reject(error);
      else resolve();
    };
    const ready = () => finish();
    const failed = () => finish(new Error('This browser could not open the file.'));
    const cancelled = () => finish(signal.reason);
    const timer = setTimeout(failed, timeout);
    signal.addEventListener('abort', cancelled, { once: true });
    media.addEventListener(readyEvent, ready, { once: true });
    media.addEventListener('error', failed, { once: true });
    if (signal.aborted) cancelled();
    else media.src = url;
  });
}

function portraitJPEG(media, width, height) {
  if (!width || !height) throw new Error('The file has no visible image.');
  const scale = Math.min(1, maxPortraitSide / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Could not prepare the photo on this device.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(media, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob?.type === jpegType && blob.size <= 5 * 1024 * 1024) resolve(blob);
      else reject(new Error('Could not save the photo. Please choose another image.'));
    }, jpegType, 0.9);
  });
}

async function fromBrowser(blob, video, signal) {
  const media = document.createElement(video ? 'video' : 'img');
  if (video) {
    media.muted = true;
    media.playsInline = true;
    media.preload = 'auto';
  }
  const url = URL.createObjectURL(blob);
  try {
    await readMedia(media, url, video ? 'loadeddata' : 'load', video ? 5000 : 12000, signal);
    return await portraitJPEG(media, video ? media.videoWidth : media.naturalWidth,
      video ? media.videoHeight : media.naturalHeight);
  } finally {
    if (video) {
      media.removeAttribute('src');
      media.load();
    }
    URL.revokeObjectURL(url);
  }
}

async function fromFFmpeg(file, signal) {
  const { FFmpeg } = await import(ffmpegSource);
  signal.throwIfAborted();
  const converter = new FFmpeg();
  const conversion = new AbortController();
  const cancel = () => conversion.abort();
  const timer = setTimeout(cancel, 60000);
  const options = { signal: conversion.signal };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    await converter.load({
      classWorkerURL: new URL('./staff-photo-worker.js', import.meta.url).href,
      coreURL: ffmpegCore + '.js',
      wasmURL: ffmpegCore + '.wasm'
    }, options);
    conversion.signal.throwIfAborted();
    await converter.writeFile('portrait-input', new Uint8Array(await file.arrayBuffer()), options);
    conversion.signal.throwIfAborted();
    const code = await converter.exec([
      '-protocol_whitelist', 'file,pipe', '-i', 'portrait-input', '-map', '0:v:0',
      '-frames:v', '1', '-vf', "scale='min(1600,iw)':'min(1600,ih)':force_original_aspect_ratio=decrease",
      '-q:v', '3', 'portrait.jpg'
    ], 15000, options);
    if (code !== 0) throw new Error('Could not decode the portrait.');
    const bytes = await converter.readFile('portrait.jpg', 'binary', options);
    return await fromBrowser(new Blob([bytes], { type: jpegType }), false, signal);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
    converter.terminate();
  }
}

export async function prepareStaffPhoto(file, signal) {
  if (!file.size) throw new Error('This file is empty. Please choose another photo.');
  if (file.size > maxInputBytes) throw new Error('Choose a photo or short video up to 25 MB.');
  const video = file.type.startsWith('video/') || videoExtension.test(file.name);
  try {
    return await fromBrowser(file, video, signal);
  } catch {
    signal.throwIfAborted();
  }

  try {
    if (/\.(heic|heif)$/i.test(file.name) || /^image\/hei[cf](?:-sequence)?$/i.test(file.type)) {
      const { heicTo } = await import('https://cdn.jsdelivr.net/npm/heic-to@1.6.7/dist/csp/heic-to.js');
      signal.throwIfAborted();
      const still = await heicTo({ blob: file, type: jpegType, quality: 0.9 });
      return await fromBrowser(still, false, signal);
    }
    if (video || legacyImageExtension.test(file.name) || /^image\/(tiff|x-tiff)$/.test(file.type)) {
      return await fromFFmpeg(file, signal);
    }
  } catch {
    signal.throwIfAborted();
  }
  throw new Error('This file could not be opened. Try another photo or video, or save a copy as JPG.');
}
