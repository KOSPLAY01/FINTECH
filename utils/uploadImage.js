const uploadImage = async (file, cloudinary, fs) => {
  if (!file) return null;
  const result = await cloudinary.uploader.upload(file.path, {
    folder: 'FINTECH_API',
  });
  fs.unlinkSync(file.path);
  return result.secure_url;
};

export default uploadImage;
