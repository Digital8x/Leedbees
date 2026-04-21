import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios.js';
import {
  Users, Upload, AlertTriangle, Plus, Activity,
  RefreshCw, MapPin, X, BarChart2, CheckCircle,
  Smartphone, UserPlus, FileText, Download,
  TrendingUp, Clock, ShieldAlert, Zap
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import toast from 'react-hot-toast';

const API_V2_URL = '/dashboard_v2.php';
const PIE_COLORS = ['#7c3aed','#06b6d4','#10b981','#f59e0b','#ef4444','#a855f7','#8b5cf6','#34d399','#6b7280'];

export default function DashboardV2() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState('');
  const [allLocations, setAllLocations] = useState([]);
  const [kpiToggle, setKpiToggle] = useState('today');

  useEffect(() => {
    api.getAllLocations?.()
      .then(r => setAllLocations(r.data?.data?.locations || []))
      .catch(() => setAllLocations([]));
  }, []);

  const loadData = useCallback((signal) => {
    setLoading(true);
    api.get(API_V2_URL, { params: { location }, signal })
      .then(res => {
        setData(res.data?.data ?? null);
      })
      .catch(err => {
        if (err?.name === 'CanceledError' || err?.name === 'AbortError') return; // Ignore stale requests
        toast.error('Failed to load Dashboard V2 stats');
      })
      .finally(() => setLoading(false));
  }, [location]);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort(); // Cancel in-flight request on location change
  }, [loadData]);

  if (loading) return (
    <div>
      <div className="topbar"><h1>Command Center ⚡</h1></div>
      <div className="loading-overlay"><div className="spinner"/><span>Synchronizing...</span></div>
    </div>
  );

  const stats = data || {};
  const kpis = stats.kpis || {};
  const currentKpis = kpiToggle === 'today' ? kpis.today || {} : kpis.overall || {};

  return (
    <div className="dashboard-v2">
      {/* HEADER */}
      <div className="topbar">
        <h1>Command Center ⚡</h1>
        <div className="topbar-actions">
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <MapPin size={14} color="var(--accent)" />
            <select
              className="form-select"
              value={location}
              onChange={e => setLocation(e.target.value)}
              style={{ fontSize:'0.82rem', padding:'4px 8px', minWidth:120 }}
            >
              <option value="">All Locations</option>
              {allLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => loadData()}><RefreshCw size={14}/> Refresh</button>
        </div>
      </div>

      <div className="page" style={{ paddingTop: 10 }}>

        {/* SMART ALERTS */}
        {stats.alerts?.length > 0 && (
          <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stats.alerts.map((alert, i) => (
              <div key={i} style={{ 
                background: alert.type === 'danger' ? '#fee2e2' : '#fef3c7', 
                color: alert.type === 'danger' ? '#991b1b' : '#92400e',
                padding: '10px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem', fontWeight: 600
              }}>
                <ShieldAlert size={18} />
                {alert.message}
              </div>
            ))}
          </div>
        )}

        {/* QUICK ACTIONS ENGINE */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => navigate('/leads')}><Upload size={16}/> Upload Leads</button>
          <button className="btn btn-secondary" onClick={() => navigate('/leads')}><UserPlus size={16}/> Bulk Assign</button>
          <button className="btn btn-secondary" onClick={() => navigate('/leads')}><Plus size={16}/> Add Manual Lead</button>
          <button className="btn btn-secondary" onClick={() => navigate('/leads')}><Download size={16}/> Export Segment</button>
        </div>

        {/* KPI SCORING SYSTEM */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
          <h2 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={18} color="var(--primary)"/> Overview Metrics
          </h2>
          <div style={{ display: 'flex', background: 'var(--bg-hover)', padding: 3, borderRadius: 20 }}>
            <button 
              onClick={() => setKpiToggle('today')} 
              style={{ padding: '4px 16px', borderRadius: 20, border: 'none', background: kpiToggle==='today'?'var(--primary)':'transparent', color: kpiToggle==='today'?'#fff':'var(--text-muted)', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem' }}
            >Today</button>
            <button 
              onClick={() => setKpiToggle('overall')} 
              style={{ padding: '4px 16px', borderRadius: 20, border: 'none', background: kpiToggle==='overall'?'var(--primary)':'transparent', color: kpiToggle==='overall'?'#fff':'var(--text-muted)', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem' }}
            >Overall</button>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#7c3aed22' }}><Users size={22} color="#7c3aed"/></div>
            <div className="stat-content">
              <div className="stat-value">{currentKpis.total_leads || 0}</div>
              <div className="stat-label">Total Leads</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#10b98122' }}><CheckCircle size={22} color="#10b981"/></div>
            <div className="stat-content">
              <div className="stat-value">{currentKpis.assigned_leads || 0}</div>
              <div className="stat-label">Assigned</div>
            </div>
          </div>
          <div className="stat-card">
             <div className="stat-icon" style={{ background: '#f59e0b22' }}><Clock size={22} color="#f59e0b"/></div>
            <div className="stat-content">
               <div className="stat-value">{currentKpis.unassigned_leads || 0}</div>
               <div className="stat-label">Unassigned</div>
            </div>
          </div>
          <div className="stat-card">
             <div className="stat-icon" style={{ background: '#06b6d422' }}><Zap size={22} color="#06b6d4"/></div>
            <div className="stat-content">
               <div className="stat-value">{currentKpis.fresh_leads || 0}</div>
               <div className="stat-label">Fresh (Not Contacted)</div>
            </div>
          </div>
          <div className="stat-card">
             <div className="stat-icon" style={{ background: '#ef444422' }}><AlertTriangle size={22} color="#ef4444"/></div>
            <div className="stat-content">
               <div className="stat-value">{currentKpis.duplicates || 0}</div>
               <div className="stat-label">Duplicates</div>
            </div>
          </div>
          {kpiToggle === 'overall' && (
            <div className="stat-card">
               <div className="stat-icon" style={{ background: '#8b5cf622' }}><Activity size={22} color="#8b5cf6"/></div>
              <div className="stat-content">
                 <div className="stat-value">{stats.active_users || 0}</div>
                 <div className="stat-label">Active Users</div>
              </div>
            </div>
          )}
        </div>

        {/* TWO-COLUMN LAYOUT */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 350px', gap: 20 }}>
          
          {/* MAIN COLUMN: LIGHT CHARTS & SOURCES */}
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              
              <div className="card">
                <div className="section-title"><BarChart2 size={18} color="var(--accent)"/> Leads by Source</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stats.charts?.source || []}>
                    <XAxis dataKey="source" tick={{fontSize:10}} interval={0} angle={-25} textAnchor="end" height={50}/>
                    <Tooltip cursor={{fill:'#f3f4f6'}} contentStyle={{ borderRadius: 8, fontSize: 12 }}/>
                    <Bar dataKey="count" fill="var(--primary)" barSize={25} radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {!location && (
                <div className="card">
                  <div className="section-title"><MapPin size={18} color="var(--accent)"/> Location Distribution</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={stats.charts?.location || []} dataKey="count" nameKey="location" cx="50%" cy="50%" outerRadius={70}>
                        {(stats.charts?.location || []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              
              {location && (
                <div className="card">
                  <div className="section-title"><Smartphone size={18} color="var(--accent)"/> Device Type</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={stats.charts?.device || []} dataKey="count" nameKey="device" cx="50%" cy="50%" outerRadius={70}>
                        {(stats.charts?.device || []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

            </div>
          </div>

          {/* SIDEBAR COLUMN: LIVE ACTIVITY STREAM */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 16, borderBottom: '1px solid var(--border)', background: 'var(--bg-light)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={16} color="var(--primary)" /> Live Activity Stream
            </div>
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 460 }}>
              {(!stats.activities || stats.activities.length === 0) ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No recent activity.</div>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {(stats.activities || []).map((act, i) => (
                    <li key={i} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', marginTop: 6 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                          <strong>{act.actor}</strong> {act.action}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          {act.time} {act.source && ` • [${act.source}]`}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
