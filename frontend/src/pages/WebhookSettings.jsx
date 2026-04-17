import { useEffect, useState } from 'react'
import { getWebhookSources, saveWebhookSource, deleteWebhookSource } from '../api/axios.js'
import { Settings, Plus, Save, Trash2, Globe, Facebook, Linkedin, Copy, Check } from 'lucide-react'
import toast from 'react-hot-toast'

export default function WebhookSettings() {
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [copiedId, setCopiedId] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await getWebhookSources()
      setSources(res.data.data.sources)
    } catch { toast.error('Failed to load webhook settings.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleAdd = () => {
    setSources([...sources, { platform: 'google', source_name: '', verify_token: '', app_secret: '', graph_token: '', is_active: 1, isNew: true }])
  }

  const handleChange = (index, field, value) => {
    const updated = [...sources]
    updated[index][field] = value
    setSources(updated)
  }

  const handleSave = async (index) => {
    setIsSaving(true)
    try {
      const s = sources[index]
      await saveWebhookSource(s)
      toast.success('Settings saved!')
      load()
    } catch { toast.error('Failed to save settings.') }
    finally { setIsSaving(false) }
  }

  const handleDelete = async (index) => {
    const s = sources[index]
    if (s.isNew) {
       setSources(sources.filter((_, i) => i !== index))
       return
    }
    if (!confirm('Are you sure you want to delete this source?')) return
    try {
      await deleteWebhookSource(s.id)
      toast.success('Source deleted.')
      load()
    } catch { toast.error('Failed to delete source.') }
  }

  const copyUrl = async (platform, id) => {
    if (!id) return;
    const baseUrl = window.location.origin + '/api/webhooks/'
    const url = `${baseUrl}${platform}.php`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
      toast.success('URL copied to clipboard!')
    } catch (err) {
      toast.error('Failed to copy URL.')
    }
  }

  const getIcon = (platform) => {
    if (platform === 'google') return <Globe size={20} color="#4285F4"/>
    if (platform === 'meta') return <Facebook size={20} color="#1877F2"/>
    if (platform === 'linkedin') return <Linkedin size={20} color="#0A66C2"/>
    return <Globe size={20}/>
  }

  return (
    <div>
      <div className="topbar">
        <h1>Webhook Settings</h1>
        <div className="topbar-actions">
          <button className="btn btn-primary" onClick={handleAdd}>
            <Plus size={16}/> Create New Source
          </button>
        </div>
      </div>

      <div className="page">
        {loading ? (
          <div className="loading-overlay"><div className="spinner"/></div>
        ) : (
          <div className="grid grid-1 gap-6">
            {sources.map((s, i) => (
              <div className="card" key={s.id || `new-${i}`}>
                <div className="card-header flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {getIcon(s.platform)}
                    <h3 className="text-lg font-bold">{s.source_name || 'New Webhook Source'}</h3>
                    <span className={`badge ${s.is_active ? 'badge-assigned' : 'badge-new'}`}>
                       {s.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      className="btn btn-secondary btn-sm" 
                      onClick={() => copyUrl(s.platform, s.id)}
                      title="Copy Webhook URL"
                    >
                      {copiedId === s.id ? <Check size={14}/> : <Copy size={14}/>}
                    </button>
                    <button className="btn btn-success btn-sm" onClick={() => handleSave(i)} disabled={isSaving}>
                      <Save size={14}/>
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(i)}>
                      <Trash2 size={14}/>
                    </button>
                  </div>
                </div>

                <div className="grid grid-2 gap-4">
                  <div className="form-group">
                    <label>Platform</label>
                    <select 
                      className="form-input" 
                      value={s.platform} 
                      onChange={(e) => handleChange(i, 'platform', e.target.value)}
                    >
                      <option value="google">Google Ads</option>
                      <option value="meta">Meta (Facebook/Instagram)</option>
                      <option value="linkedin">LinkedIn</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Source Name (Unique ID)</label>
                    <input 
                      type="text" className="form-input" 
                      value={s.source_name} placeholder="e.g. My_FB_Campaign"
                      onChange={(e) => handleChange(i, 'source_name', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-3 gap-4 mt-4">
                   <div className="form-group">
                    <label>Verify Token / Secret Key</label>
                    <input 
                      type="password" className="form-input" 
                      value={s.verify_token || ''}
                      onChange={(e) => handleChange(i, 'verify_token', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>App Secret (Meta/LinkedIn)</label>
                    <input 
                      type="password" className="form-input" 
                      value={s.app_secret || ''}
                      onChange={(e) => handleChange(i, 'app_secret', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Graph API Token (Meta Long-lived)</label>
                    <input 
                      type="password" className="form-input" 
                      value={s.graph_token || ''}
                      onChange={(e) => handleChange(i, 'graph_token', e.target.value)}
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                   <input 
                     type="checkbox" id={`active-${i}`} 
                     checked={!!s.is_active} 
                     onChange={(e) => handleChange(i, 'is_active', e.target.checked ? 1 : 0)}
                   />
                   <label htmlFor={`active-${i}`} style={{margin:0, cursor:'pointer'}}>Enable real-time ingestion for this source</label>
                </div>
              </div>
            ))}

            {sources.length === 0 && (
              <div className="card text-center py-12">
                 <p className="text-muted">No webhook sources configured yet.</p>
                 <button className="btn btn-primary mt-4" onClick={handleAdd}>Create Your First Webhook</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
