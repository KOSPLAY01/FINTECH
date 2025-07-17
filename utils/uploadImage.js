const uploadImage = async (file, cloudinary) => {
  if (!file) return null;
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'FINTECH_API' },
      (error, result) => {
        if (result) resolve(result.secure_url);
        else reject(error);
      }
    );
    stream.end(file.buffer);  // send buffer directly
  });
};

export default uploadImage;
