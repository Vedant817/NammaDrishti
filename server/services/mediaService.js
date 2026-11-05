const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const MEDIA_DIR = process.env.MEDIA_DIR || path.join(__dirname, '../runtime/media');
async function processMediaUpload({ imageBase64, mimeType }) {
  if (typeof imageBase64 !== 'string' || imageBase64.length > 2800000) throw new Error('Image must be smaller than 2 MB');
  if (mimeType && !['image/jpeg','image/png','image/webp','image/avif'].includes(mimeType)) throw new Error('Unsupported image format');
  const encoded = imageBase64.replace(/^data:image\/(jpeg|png|webp|avif);base64,/, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('Invalid image encoding');
  const input = Buffer.from(encoded, 'base64');
  // Decode with a pixel bound and re-encode: MIME sniffing, no EXIF/GPS metadata.
  const metadata = await sharp(input, { limitInputPixels: 16000000, failOn: 'warning' }).metadata();
  if (!['jpeg','png','webp','avif'].includes(metadata.format) || (metadata.pages || 1) > 1) throw new Error('Unsupported or animated image');
  const image = await sharp(input, { limitInputPixels: 16000000 }).rotate().resize(1200,1200,{fit:'inside',withoutEnlargement:true}).webp({quality:75}).toBuffer();
  const hash = crypto.createHash('sha256').update(image).digest('hex');
  const filename = `${hash}.webp`;
  await fs.mkdir(MEDIA_DIR,{recursive:true});
  const files = await fs.readdir(MEDIA_DIR);
  // Fixed object budget, no silent eviction of referenced citizen evidence.
  if (files.length >= 10000 && !files.includes(filename)) throw new Error('Media storage full; operator maintenance required');
  const temp = path.join(MEDIA_DIR,`${hash}.${crypto.randomUUID()}.tmp`);
  await fs.writeFile(temp,image,{flag:'wx',mode:0o600});
  await fs.rename(temp,path.join(MEDIA_DIR,filename));
  return {provider:'Persistent disk',mediaUrl:`/api/media/objects/${filename}`,filename,hash,byteSize:image.length,mimeType:'image/webp'};
}
module.exports = { processMediaUpload, MEDIA_DIR };
