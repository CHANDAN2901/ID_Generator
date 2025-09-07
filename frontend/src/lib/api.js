import axios from 'axios'

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

const api = axios.create({
  baseURL: API_BASE,
})

export function toAbsoluteUrl(p) {
  if (!p) return p
  if (/^https?:\/\//i.test(p) || /^data:image\//i.test(p)) return p
  const origin = API_BASE.replace(/\/api\/?$/, '')
  return origin + p
}

export async function uploadTemplate(file, name) {
  const fd = new FormData()
  fd.append('file', file)
  if (name) fd.append('name', name)
  const { data } = await api.post('/templates', fd)
  return data
}

export async function saveLayout(id, { fields, mapping }) {
  const { data } = await api.put(`/templates/${id}/layout`, { fields, mapping })
  return data
}

export async function uploadDataset(file) {
  const fd = new FormData()
  fd.append('file', file)
  const { data } = await api.post('/datasets', fd)
  return data
}

export async function getDataset(id) {
  const { data } = await api.get(`/datasets/${id}`)
  return data
}

export async function previewGenerate(templateId, record) {
  const { data } = await api.post('/generate/preview', { templateId, record })
  return data
}

export async function batchGenerate(templateId, datasetId, range, options = {}) {
  const { cmyk = true } = options
  const { data } = await api.post('/generate/batch', { templateId, datasetId, range, cmyk })
  return data
}

export async function checkCMYKSupport() {
  const { data } = await api.get('/generate/cmyk-support')
  return data
}

