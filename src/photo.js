export const MAX_IMAGE_BYTES = 20 * 1024 * 1024
const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/bmp',
])

export function validateImageFile(file) {
  if (!SUPPORTED_IMAGE_TYPES.has(file?.type)) return 'Choose a JPEG, PNG, WebP, GIF, AVIF, or BMP image.'
  if (file.size > MAX_IMAGE_BYTES) return 'Images must be 20 MB or smaller.'
  return null
}

export function resizeImage(file, max = 1600, quality = 0.82) {
  const problem = validateImageFile(file)
  if (problem) return Promise.reject(new Error(problem))
  return new Promise((resolve, reject) => {
    const img = new Image()
    let url
    try {
      url = URL.createObjectURL(file)
    } catch (error) {
      reject(error)
      return
    }
    const release = () => URL.revokeObjectURL(url)
    img.onload = () => {
      try {
        if (!img.width || !img.height || img.width > 12000 || img.height > 12000 || img.width * img.height > 50_000_000) {
          throw new Error('This image is too large to process. Choose a smaller image.')
        }
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.round(img.width * scale)
        c.height = Math.round(img.height * scale)
        const context = c.getContext('2d')
        if (!context) throw new Error('Image processing is unavailable in this browser.')
        context.drawImage(img, 0, 0, c.width, c.height)
        c.toBlob((blob) => {
          release()
          blob ? resolve(blob) : reject(new Error('Could not process this image.'))
        }, 'image/jpeg', quality)
      } catch (error) {
        release()
        reject(error)
      }
    }
    img.onerror = () => {
      release()
      reject(new Error('Could not read this image. Try a JPG or PNG.'))
    }
    img.src = url
  })
}
