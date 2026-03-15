const API_URL = import.meta.env.VITE_API_URL || 'http://187.124.18.102:3100'

let authToken = null

export function setAuthToken(token) {
  authToken = token
}

async function request(method, path, body, isFormData = false) {
  const headers = {}
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`
  if (!isFormData) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: isFormData ? body : (body ? JSON.stringify(body) : undefined)
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Request failed')
  }
  return res.json()
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),
  postForm: (path, formData) => request('POST', path, formData, true),
  // Stats
  getStats: () => request('GET', '/api/stats'),
  // Videos
  getVideos: () => request('GET', '/api/videos'),
  getVideo: (id) => request('GET', `/api/videos/${id}`),
  addVideo: (url, title) => request('POST', '/api/videos', { url, title }),
  deleteVideo: (id) => request('DELETE', `/api/videos/${id}`),
  // Links
  getLinks: () => request('GET', '/api/links'),
  addLink: (url, title) => request('POST', '/api/links', { url, title }),
  deleteLink: (id) => request('DELETE', `/api/links/${id}`),
  // Photos
  getPhotos: () => request('GET', '/api/photos'),
  uploadPhoto: (formData) => request('POST', '/api/photos', formData, true),
  deletePhoto: (id) => request('DELETE', `/api/photos/${id}`),
  // Notes
  getNotes: () => request('GET', '/api/notes'),
  addNote: (content, refs) => request('POST', '/api/notes', { content, ...refs }),
  updateNote: (id, content) => request('PUT', `/api/notes/${id}`, { content }),
  deleteNote: (id) => request('DELETE', `/api/notes/${id}`),
  // Search
  search: (query, types) => request('POST', '/api/search', { query, types }),
}
