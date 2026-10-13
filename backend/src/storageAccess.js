function ownsPhotoPath(path,userId) {
  if (typeof path!=='string' || !userId || path.includes('..') || path.includes('\\')) return false;
  const parts=path.split('/');
  return parts[0]===userId || (parts[0]==='photos' && parts[1]===userId);
}
module.exports={ ownsPhotoPath };
