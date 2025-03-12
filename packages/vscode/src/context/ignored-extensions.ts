export const ignored_extensions = new Set([
  // Images
  'png',
  'jpg',
  'jpeg',
  'gif',
  'bmp',
  'ico',
  'webp',
  'tiff',
  'psd',
  // Videos
  'mp4',
  'webm',
  'avi',
  'mov',
  'wmv',
  'flv',
  'mkv',
  // Audio
  'mp3',
  'wav',
  'ogg',
  'm4a',
  'aac',
  'flac',
  // Archives
  'zip',
  'rar',
  '7z',
  'tar',
  'gz',
  'bz2',
  // Fonts
  'ttf',
  'otf',
  'woff',
  'woff2',
  'eot',
  // Other binary/media
  'pdf',
  'exe',
  'dll',
  'so',
  'dylib',
  // Cache and compiled files
  'cache',
  'class',
  'pyc',
  'pyo',
  // Lock files (often very large)
  'lock',
  'lockb',
  // Large data files
  'csv',
  'xls',
  'xlsx',
  'db',
  'sqlite'
])
