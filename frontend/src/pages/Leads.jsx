import { useEffect, useState, useRef } from 'react'
import { getLeads, downloadLeads, uploadLeads, updateFeedback, bulkFeedback, getTimeline, triggerDownload } from '../api/axios.js'
import { Search, Download, Upload, X, Clock, RefreshCw, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUSES = ['New','Assigned','Called','Interested','Follow Up','Site Visit','Booked','Not Interested','Wrong Number']

const statusBadgeClass = s => ({
  'New':'badge-new','Assigned':'badge-assigned','Called':'badge-called',
  'Interested':'badge-interested','Follow Up':'badge-follow-up','Site Visit':'badge-site-visit',
  'Booked':'badge-booked','Not Interested':'badge-not-interested','Wrong Number':'badge-wrong-number'
}[s] || 'badge-new')

export default function Leads() {
  const user = JSON.parse(localStorage.getItem('lead8x_user') || '{}')
  const [leads, setLeads]     = useState([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ search:'', status:'', batch_id:'' })
  const [selected, setSelected] = useState(null)
  const [timeline, setTimeline] = useState(null)
  const [showUpload, setShowUpload]   = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [showTimeline, setShowTimeline] = useState(false)
  const [uploadForm, setUploadForm]   = useState({ source:'', campaign:'', file: null })
  const [fbFile, setFbFile]           = useState(null)
  const [editRow, setEditRow]         = useState(null)
  const fileRef = useRef()
  const fbRef   = useRef()

  const load = async (p = page) => {
    setLoading(true)
    try {
      const res = await getLeads({ page: p, limit: 50, ...filters })
      setLeads(res.data.data.leads)
      setTotal(res.data.data.total)
      setTotalPages(res.data.data.total_pages)
    } catch { toast.error('Failed to load leads.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load(1) }, [filters])

  const handleDownload = async () => {
    try {
      const res = await downloadLeads(filters)
      triggerDownload(res.data, `Leads_${Date.now()}.xlsx`)
      toast.success('Download started!')
    } catch { toast.error('Download failed.') }
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!uploadForm.file) return toast.error('Select a file.')
    const fd = new FormData()
    fd.append('file', uploadForm.file)
    fd.append('source', uploadForm.source || 'Upload')
    fd.append('campaign', uploadForm.campaign)
    try {
      const res = await uploadLeads(fd)
      const d = res.data.data
      toast.success(`✅ ${d.new} new · ${d.duplicates} duplicates · ${d.skipped} skipped`)
      setShowUpload(false)
      setUploadForm({ source:'', campaign:'', file:null })
      load(1)
    } catch (err) { toast.error(err.response?.data?.message || 'Upload failed.') }
  }

  const handleBulkFeedback = async (e) => {
    e.preventDefault()
    if (!fbFile) return toast.error('Select a feedback file.')
    const fd = new FormData()
    fd.append('file', fbFile)
    try {
      const res = await bulkFeedback(fd)
      toast.success(`Updated ${res.data.data.updated} leads`)
      setShowFeedback(false); setFbFile(null); load()
    } catch (err) { toast.error(err.response?.data?.message || 'Feedback failed.') }
  }

  const handleStatusUpdate = async (e) => {
    e.preventDefault()
    try {
      await updateFeedback({ phone: editRow.phone, status: editRow.status, remark: editRow.remark })
      toast.success('Lead updated')
      setEditRow(null); load()
    } catch (err) { toast.error(err.response?.data?.message || 'Update failed.') }
  }

  const openTimeline = async (lead) => {
    setSelected(lead); setShowTimeline(true)
    try {
      const res = await getTimeline(lead.id)
      setTimeline(res.data.data)
    } catch { toast.error('Failed to load timeline.') }
  }

  return (
    <div>
      <div className="topbar">
        <h1>Leads <span style={{color:'var(--text-muted)',fontWeight:400,fontSize:'1rem'}}>({total.toLocaleString()})</span></h1>
        <div className="topbar-actions">
          {['Admin','Manager'].includes(user.role) && (
            <button id="btn-upload" className="btn btn-primary btn-sm" onClick={() => setShowUpload(true)}><Upload size={15}/> Upload</button>
          )}
          <button id="btn-bulk-feedback" className="btn btn-secondary btn-sm" onClick={() => setShowFeedback(true)}><Upload size={15}/> Bulk Feedback</button>
          <button id="btn-download" className="btn btn-secondary btn-sm" onClick={handleDownload}><Download size={15}/> Download</button>
          <button className="btn btn-secondary btn-sm" onClick={() => load()}><RefreshCw size={14}/></button>
        </div>
      </div>

      <div className="page">
        {/* Filters */}
        <div className="filters-bar">
          <div className="search-box" style={{flex:1}}>
            <Search size={15}/>
            <input className="form-input" placeholder="Search phone, name, email…" value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
          </div>
          <select className="form-select" style={{width:160}} value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <input className="form-input" style={{width:200}} placeholder="Filter by Batch ID"
            value={filters.batch_id} onChange={e => setFilters(f => ({ ...f, batch_id: e.target.value }))} />
        </div>

        {/* Table */}
        <div className="card" style={{padding:0}}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>#</th><th>Phone</th><th>Name</th><th>Status</th><th>Source</th><th>Assigned To</th><th>Duplicate</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {loading
                  ? <tr><td colSpan={8}><div className="loading-overlay"><div className="spinner"/></div></td></tr>
                  : leads.length === 0
                    ? <tr><td colSpan={8}><div className="empty-state"><Search size={40}/><h3>No leads found</h3><p>Try adjusting filters</p></div></td></tr>
                    : leads.map((l, i) => (
                        <tr key={l.id} className={l.is_duplicate == 1 ? 'is-duplicate' : ''}>
                          <td className="text-muted text-xs">{(page-1)*50+i+1}</td>
                          <td><strong style={{fontFamily:'monospace'}}>{l.phone}</strong></td>
                          <td>{l.name || <span className="text-muted">–</span>}</td>
                          <td><span className={`badge ${statusBadgeClass(l.status)}`}>{l.status}</span></td>
                          <td className="text-xs text-muted truncate" style={{maxWidth:120}}>{l.first_source || '–'}</td>
                          <td>{l.assigned_to_name || <span className="text-muted">Unassigned</span>}</td>
                          <td>
                            {l.is_duplicate == 1
                              ? <span className="badge" style={{background:'var(--warning-bg)',color:'var(--warning)'}}><AlertTriangle size={10}/> {l.duplicate_count}x</span>
                              : <span className="text-muted text-xs">–</span>}
                          </td>
                          <td>
                            <div className="flex gap-2">
                              <button className="btn btn-secondary btn-sm" onClick={() => setEditRow({...l})} title="Edit status/remark">Edit</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => openTimeline(l)} title="View timeline"><Clock size={13}/></button>
                            </div>
                          </td>
                        </tr>
                      ))
                }
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination mt-4">
            <button className="page-btn" disabled={page===1} onClick={() => { setPage(1); load(1) }}>«</button>
            <button className="page-btn" disabled={page===1} onClick={() => { setPage(p=>p-1); load(page-1) }}>‹</button>
            {[...Array(Math.min(5, totalPages))].map((_,i) => {
              const p = Math.max(1, Math.min(page-2, totalPages-4)) + i
              return <button key={p} className={`page-btn${p===page?' active':''}`} onClick={() => { setPage(p); load(p) }}>{p}</button>
            })}
            <button className="page-btn" disabled={page===totalPages} onClick={() => { setPage(p=>p+1); load(page+1) }}>›</button>
            <button className="page-btn" disabled={page===totalPages} onClick={() => { setPage(totalPages); load(totalPages) }}>»</button>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📤 Upload Leads</h3>
              <button className="modal-close" onClick={() => setShowUpload(false)}><X size={18}/></button>
            </div>
            <form onSubmit={handleUpload}>
              <div className="form-group">
                <label className="form-label">Source Name *</label>
                <input className="form-input" placeholder="e.g. MagicBricks, 99Acres" required
                  value={uploadForm.source} onChange={e => setUploadForm(f=>({...f,source:e.target.value}))}/>
              </div>
              <div className="form-group">
                <label className="form-label">Campaign (optional)</label>
                <input className="form-input" placeholder="e.g. Diwali 2024"
                  value={uploadForm.campaign} onChange={e => setUploadForm(f=>({...f,campaign:e.target.value}))}/>
              </div>
              <div className="form-group">
                <label className="form-label">Excel / CSV File *</label>
                <div className="upload-zone" onClick={() => fileRef.current.click()}>
                  <Upload size={32}/>
                  <p>{uploadForm.file ? uploadForm.file.name : 'Click to browse or drag & drop'}</p>
                  <small>Supports .xlsx, .xls, .csv · Max 50MB</small>
                </div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}}
                  onChange={e => setUploadForm(f=>({...f,file:e.target.files[0]}))}/>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowUpload(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Upload & Process</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Feedback Modal */}
      {showFeedback && (
        <div className="modal-overlay" onClick={() => setShowFeedback(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📋 Bulk Feedback Upload</h3>
              <button className="modal-close" onClick={() => setShowFeedback(false)}><X size={18}/></button>
            </div>
            <div className="alert alert-info mt-2">Excel must have columns: <strong>Phone, Status, Remark</strong></div>
            <form onSubmit={handleBulkFeedback}>
              <div className="form-group">
                <div className="upload-zone" onClick={() => fbRef.current.click()}>
                  <Upload size={32}/>
                  <p>{fbFile ? fbFile.name : 'Click to select feedback file'}</p>
                  <small>.xlsx, .xls, .csv</small>
                </div>
                <input ref={fbRef} type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}} onChange={e => setFbFile(e.target.files[0])}/>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowFeedback(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Feedback</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Lead Modal */}
      {editRow && (
        <div className="modal-overlay" onClick={() => setEditRow(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✏️ Update Lead — {editRow.phone}</h3>
              <button className="modal-close" onClick={() => setEditRow(null)}><X size={18}/></button>
            </div>
            <form onSubmit={handleStatusUpdate}>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={editRow.status}
                  onChange={e => setEditRow(r => ({...r, status: e.target.value}))}>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Remark</label>
                <textarea className="form-textarea" placeholder="Add notes or remark…"
                  value={editRow.remark || ''} onChange={e => setEditRow(r => ({...r, remark: e.target.value}))}/>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditRow(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Timeline Modal */}
      {showTimeline && selected && (
        <div className="modal-overlay" onClick={() => { setShowTimeline(false); setTimeline(null) }}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🕐 Timeline — {selected.phone}{selected.name ? ` (${selected.name})` : ''}</h3>
              <button className="modal-close" onClick={() => { setShowTimeline(false); setTimeline(null) }}><X size={18}/></button>
            </div>
            {!timeline
              ? <div className="loading-overlay"><div className="spinner"/></div>
              : <>
                  {timeline.sources?.length > 0 && (
                    <div style={{marginBottom:20}}>
                      <div className="section-title" style={{fontSize:'0.85rem'}}>Upload History</div>
                      {timeline.sources.map((s,i) => (
                        <div key={i} style={{padding:'8px 12px',background:'var(--bg-elevated)',borderRadius:8,marginBottom:6,fontSize:'0.82rem'}}>
                          <strong>{s.batch_id}</strong> · {s.source_name || 'Unknown'} · {s.uploaded_by || '–'}
                          <span className="text-muted" style={{float:'right'}}>{new Date(s.uploaded_at).toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="section-title" style={{fontSize:'0.85rem'}}>Activity Timeline</div>
                  <div className="timeline">
                    {timeline.timeline?.map((ev,i) => (
                      <div className="timeline-item" key={i}>
                        <div className="timeline-dot"/>
                        <div className="timeline-content">
                          <div className="timeline-event">{ev.event_type}</div>
                          <div className="timeline-desc">{ev.description}</div>
                          <div className="timeline-meta">by {ev.actor_name || 'System'} · {new Date(ev.created_at).toLocaleString('en-IN')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
            }
          </div>
        </div>
      )}
    </div>
  )
}
