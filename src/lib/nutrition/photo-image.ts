import sharp from "sharp";
export async function preparePhoto(bytes: Uint8Array, mime: string, size = 1600): Promise<Buffer> {
  if (!bytes.length || bytes.length > 3 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(mime)) throw new Error("Choose a JPEG, PNG or WebP image up to 3 MB.");
  const image = sharp(bytes, { limitInputPixels: 20000000, animated: false });
  const metadata = await image.metadata();
  if ((metadata.pages ?? 1) > 1 || !["jpeg", "png", "webp"].includes(metadata.format ?? "") || mime !== `image/${metadata.format}`) throw new Error("The image contents do not match its type, or it is animated.");
  // Decode, orient, resize and re-encode: do not retain EXIF/location metadata.
  return image.rotate().resize({ width: size, height: size, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
}
