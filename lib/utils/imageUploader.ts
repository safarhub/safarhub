// lib/utils/imageUploader.ts
import { v2 as cloudinary } from "cloudinary";

const getCloudinaryConfig = () => {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME ?? process.env.CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY ?? process.env.API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET ?? process.env.API_SECRET;

  return { cloud_name, api_key, api_secret };
};

export const cloudinaryConnect = () => {
  const config = getCloudinaryConfig();
  const missingVars: string[] = [];

  if (!config.cloud_name) missingVars.push("CLOUDINARY_CLOUD_NAME");
  if (!config.api_key) missingVars.push("CLOUDINARY_API_KEY");
  if (!config.api_secret) missingVars.push("CLOUDINARY_API_SECRET");

  if (missingVars.length) {
    throw new Error(
      `Cloudinary config missing: ${missingVars.join(", ")}. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in your environment.`
    );
  }

  cloudinary.config(config);
};

export const uploadImageToCloudinary = async (file: { tempFilePath: string }, folder = "profile_pics") => {
  cloudinaryConnect();
  return cloudinary.uploader.upload(file.tempFilePath, { folder, resource_type: "auto" });
};
