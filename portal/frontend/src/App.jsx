import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Square, 
  ExternalLink, 
  Database, 
  Cpu, 
  Layers, 
  Calendar, 
  Activity, 
  Radio, 
  MessageSquare,
  Sparkles,
  RefreshCw,
  Server,
  LayoutDashboard,
  Key,
  Users,
  LogOut,
  UserCheck,
  Trash2,
  Lock
} from 'lucide-react';

const API_BASE = '/api';

const SERVICE_THEMES = {
  datalake: '#0078d4',
  databricks: '#ff3621',
  airflow: '#017a8a',
  synapse: '#00a4ef',
  eventhub: '#ffb900',
  servicebus: '#ff5f00',
  monitoring: '#7fba00'
};

const SERVICE_ICONS = {
  datalake: Database,
  databricks: Sparkles,
  airflow: Calendar,
  synapse: Layers,
  eventhub: Radio,
  servicebus: MessageSquare,
  monitoring: Activity
};

const SERVICE_CREDENTIALS = {
  datalake: "admin / password",
  databricks: "No login needed",
  airflow: "No login needed (auto-admin)",
  synapse: "No login needed (auto-admin)",
  eventhub: "No login needed",
  servicebus: "guest / guest",
  monitoring: "No login needed (auto-admin)"
};

const PROXIED_SERVICE_URLS = {
  datalake: "/services/datalake/",
  databricks: "/services/databricks/",
  airflow: "/services/airflow/",
  synapse: "/services/synapse/",
  eventhub: "/services/eventhub/",
  servicebus: "/services/servicebus/",
  monitoring: "/services/monitoring/"
};

const DATABRICKS_NOTEBOOKS = [
  {
    name: "Medallion Architecture & TPC-H",
    file: "Medallion_Architecture_TPCH.ipynb",
    description: "Orchestrate ADLS Bronze -> Silver -> Gold pipelines using Spark and Delta Lake."
  },
  {
    name: "Databricks Features Demo",
    file: "databricks_features_demo.ipynb",
    description: "Explore Delta MERGE, Schema Enforcement & Evolution, Time Travel, and Auto Loader."
  },
  {
    name: "Spark SQL Practice",
    file: "practice_pyspark_sql.ipynb",
    description: "Run interactive SQL commands and Spark DataFrame API transforms."
  },
  {
    name: "Event Hub Ingestion (Streaming)",
    file: "project2_eventhub_streaming.ipynb",
    description: "Consume structured transaction events from Redpanda via Spark Streaming."
  },
  {
    name: "CDC Pipeline Consumer",
    file: "project4_cdc_pipeline.ipynb",
    description: "Consume real-time database Change Data Capture updates and merge them."
  }
];

const AIRFLOW_DAGS = [
  {
    id: "project1_adf_batch_pipeline",
    name: "ADF Batch ETL Pipeline",
    description: "Copies CSV data to ADLS, triggers Spark, and writes gold aggregates to Postgres."
  },
  {
    id: "project3_adf_incremental_load",
    name: "ADF Incremental Load",
    description: "Polls transactions from API incrementally and merges changes to Synapse."
  },
  {
    id: "adf_features_demo",
    name: "ADF Features & Activities",
    description: "Runs Lookups, metadata checks, Copy operations, and conditional branching."
  }
];

export default function App() {
  // Session Authentication State
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [services, setServices] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  
  // Direct Iframe Navigation State
  const [iframeUrl, setIframeUrl] = useState({});

  // AI Copilot State
  const [geminiKey, setGeminiKey] = useState(() => {
    return localStorage.getItem('gemini_api_key') || '';
  });
  const [workspaceTabs, setWorkspaceTabs] = useState({});
  const [copilotInput, setCopilotInput] = useState({});
  const [copilotResponse, setCopilotResponse] = useState({});
  const [copilotLoading, setCopilotLoading] = useState({});

  // Login Form State
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState(null);

  // User Management State
  const [userList, setUserList] = useState([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [createUserError, setCreateUserError] = useState(null);

  const fetchServices = async () => {
    try {
      const res = await fetch(`${API_BASE}/services`);
      if (!res.ok) throw new Error('Failed to fetch services status');
      const data = await res.json();
      setServices(data);
      setError(null);
    } catch (err) {
      setError('Cannot connect to portal backend. Make sure FastAPI server is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!user || user.role !== 'admin') return;
    try {
      const res = await fetch(`${API_BASE}/auth/users`, {
        headers: { 'X-User-Role': user.role }
      });
      if (res.ok) {
        const data = await res.json();
        setUserList(data);
      }
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  };

  // Automated Same-Origin authentication for MinIO Console
  const autoLoginMinio = async () => {
    try {
      await fetch('/minio-api/api/v1/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessKey: 'admin', secretKey: 'password' })
      });
      console.log("MinIO Console Auto-Login completed successfully");
    } catch (err) {
      console.error("MinIO Console Auto-Login failed", err);
    }
  };

  const loadNotebook = (fileName) => {
    setIframeUrl(prev => ({
      ...prev,
      databricks: `/services/databricks/lab/tree/notebooks/${fileName}`
    }));
    setActiveTab('databricks');
  };

  const handleCopilotSubmit = async (key, action = "general", customContent = null) => {
    const promptText = customContent !== null ? customContent : (copilotInput[key] || "");
    if (!promptText.trim()) return;

    setCopilotLoading(prev => ({ ...prev, [key]: true }));
    setCopilotResponse(prev => ({ ...prev, [key]: "🧠 Thinking..." }));

    try {
      const res = await fetch(`${API_BASE}/ai/copilot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: key,
          action: action,
          content: promptText,
          api_key: geminiKey
        })
      });

      if (!res.ok) throw new Error(`Error: ${res.statusText}`);
      const data = await res.json();
      setCopilotResponse(prev => ({ ...prev, [key]: data.response }));
      if (customContent === null) {
        setCopilotInput(prev => ({ ...prev, [key]: "" }));
      }
    } catch (err) {
      setCopilotResponse(prev => ({ ...prev, [key]: `❌ Error: ${err.message}` }));
    } finally {
      setCopilotLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const renderMarkdown = (text) => {
    if (!text) return null;
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('```')) {
        const lines = part.split('\n');
        const firstLine = lines[0];
        const lang = firstLine.slice(3).trim() || 'code';
        const code = lines.slice(1, -1).join('\n');
        
        return (
          <div key={idx} className="copilot-code-block" style={{ margin: '0.75rem 0' }}>
            <div className="copilot-code-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0e162b', padding: '0.25rem 0.5rem', borderTopLeftRadius: '6px', borderTopRightRadius: '6px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
              <span>{lang.toUpperCase()}</span>
              <button 
                onClick={() => navigator.clipboard.writeText(code)}
                style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '0.65rem' }}
              >
                Copy
              </button>
            </div>
            <pre style={{ margin: 0, padding: '0.5rem', background: '#090d16', borderBottomLeftRadius: '6px', borderBottomRightRadius: '6px', overflowX: 'auto', fontSize: '0.72rem', fontFamily: 'monospace', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.04)', borderTop: 'none' }}>
              <code>{code}</code>
            </pre>
          </div>
        );
      }
      
      const subparts = part.split(/(`[^`\n]+`)/g);
      return (
        <span key={idx} style={{ whiteSpace: 'pre-wrap', fontSize: '0.75rem', lineHeight: '1.4', color: '#e2e8f0' }}>
          {subparts.map((sub, sidx) => {
            if (sub.startsWith('`') && sub.endsWith('`')) {
              return <code key={sidx} style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.72rem', color: '#f87171' }}>{sub.slice(1, -1)}</code>;
            }
            return sub;
          })}
        </span>
      );
    });
  };

  useEffect(() => {
    if (user) {
      fetchServices();
      fetchUsers();
      autoLoginMinio();
      const interval = setInterval(fetchServices, 3000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Set default iframe URL when activeTab changes
  useEffect(() => {
    if (activeTab && activeTab !== 'dashboard' && activeTab !== 'users') {
      if (!iframeUrl[activeTab]) {
        setIframeUrl(prev => ({
          ...prev,
          [activeTab]: PROXIED_SERVICE_URLS[activeTab]
        }));
      }
    }
  }, [activeTab]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Login failed');
      }
      const data = await res.json();
      const userProfile = { username: data.username, role: data.role };
      localStorage.setItem('user', JSON.stringify(userProfile));
      setUser(userProfile);
      setActiveTab('dashboard');
    } catch (err) {
      setLoginError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    setLoginUsername('');
    setLoginPassword('');
  };

  const handleStart = async (key) => {
    setActionLoading(prev => ({ ...prev, [key]: 'starting' }));
    try {
      const res = await fetch(`${API_BASE}/services/${key}/start`, { 
        method: 'POST',
        headers: { 'X-User-Role': user.role }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to start service');
      }
      await fetchServices();
    } catch (err) {
      alert(`Error starting ${key}: ${err.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: null }));
    }
  };

  const handleStop = async (key) => {
    if (!confirm(`Are you sure you want to stop ${key}?`)) return;
    setActionLoading(prev => ({ ...prev, [key]: 'stopping' }));
    try {
      const res = await fetch(`${API_BASE}/services/${key}/stop`, { 
        method: 'POST',
        headers: { 'X-User-Role': user.role }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to stop service');
      }
      await fetchServices();
    } catch (err) {
      alert(`Error stopping ${key}: ${err.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: null }));
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateUserError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/users`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Role': user.role
        },
        body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to create user');
      }
      setNewUsername('');
      setNewPassword('');
      setNewRole('user');
      fetchUsers();
    } catch (err) {
      setCreateUserError(err.message);
    }
  };

  const handleDeleteUser = async (uname) => {
    if (!confirm(`Are you sure you want to delete user ${uname}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/auth/users/${uname}`, {
        method: 'DELETE',
        headers: { 'X-User-Role': user.role }
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to delete user');
      }
      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const getActiveCount = () => {
    return Object.values(services).filter(s => s.status === 'online').length;
  };

  // Render Login Overlay Form
  if (!user) {
    return (
      <div className="login-overlay">
        <form className="login-card" onSubmit={handleLogin}>
          <div className="login-header">
            <h2>Azure Practice Lab</h2>
            <p>Enter your credentials to access the workspace portal</p>
          </div>

          {loginError && (
            <div style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', padding: '0.65rem', borderRadius: '8px', fontSize: '0.82rem', textAlign: 'center' }}>
              ⚠️ {loginError}
            </div>
          )}

          <div className="form-group">
            <label>Login ID</label>
            <input 
              type="text" 
              className="form-input" 
              value={loginUsername} 
              onChange={e => setLoginUsername(e.target.value)} 
              placeholder="e.g. aariz"
              required 
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              className="form-input" 
              value={loginPassword} 
              onChange={e => setLoginPassword(e.target.value)} 
              placeholder="••••••••"
              required 
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ '--theme-color': '#0078d4', padding: '0.75rem', marginTop: '0.5rem', borderRadius: '10px' }}>
            Log In
          </button>
        </form>
      </div>
    );
  }

  // Render Sidebar navigation
  const renderSidebar = () => {
    const isAdmin = user.role === 'admin';
    return (
      <aside className="sidebar">
        <div>
          <div className="sidebar-brand">
            <Server size={22} style={{ color: '#0078d4' }} />
            <h2>Azure Practice Lab</h2>
          </div>
          
          <nav>
            <ul className="sidebar-menu">
              <li 
                className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveTab('dashboard')}
              >
                <LayoutDashboard size={18} />
                Dashboard
              </li>
              
              {Object.entries(services).map(([key, service]) => {
                const Icon = SERVICE_ICONS[key] || Server;
                const isOnline = service.status === 'online';
                return (
                  <li 
                    key={key}
                    className={`sidebar-item ${activeTab === key ? 'active' : ''}`}
                    onClick={() => setActiveTab(key)}
                  >
                    <Icon size={18} style={{ color: isOnline ? SERVICE_THEMES[key] : 'inherit' }} />
                    {service.name}
                    {!isOnline && (
                      <span style={{ fontSize: '0.65rem', marginLeft: 'auto', opacity: 0.5 }}>(Offline)</span>
                    )}
                  </li>
                );
              })}

              {isAdmin && (
                <>
                  <div style={{ height: '1px', background: 'var(--border-glass)', margin: '0.75rem 0' }} />
                  <li 
                    className={`sidebar-item ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                  >
                    <Users size={18} style={{ color: '#60a5fa' }} />
                    User Management
                  </li>
                </>
              )}
            </ul>
          </nav>
        </div>
        
        <div className="sidebar-footer">
          <p>M4 Core Engine v1.1</p>
          <p style={{ marginTop: '3px', fontSize: '0.7rem' }}>Constraints: &lt; 5 GB RAM</p>
        </div>
      </aside>
    );
  };

  const renderServiceReferences = (key) => {
    switch (key) {
      case 'databricks':
        return (
          <div className="reference-list">
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', lineHeight: '1.4' }}>
              Select a notebook to load it directly into the editor pane:
            </p>
            {DATABRICKS_NOTEBOOKS.map(nb => (
              <div 
                key={nb.file} 
                className="reference-item"
                onClick={() => setIframeUrl(prev => ({ ...prev, databricks: `/services/databricks/lab/tree/notebooks/${nb.file}` }))}
              >
                <h5 style={{ color: '#ff3621', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Sparkles size={12} />
                  {nb.name}
                </h5>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.3' }}>{nb.description}</p>
              </div>
            ))}
          </div>
        );
      case 'airflow':
        return (
          <div className="reference-list">
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', lineHeight: '1.4' }}>
              Select a pipeline DAG grid to monitor execution tasks:
            </p>
            {AIRFLOW_DAGS.map(dag => (
              <div 
                key={dag.id} 
                className="reference-item"
                onClick={() => setIframeUrl(prev => ({ ...prev, airflow: `/services/airflow/dags/${dag.id}/grid` }))}
              >
                <h5 style={{ color: '#017a8a', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={12} />
                  {dag.name}
                </h5>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.3' }}>{dag.description}</p>
              </div>
            ))}
          </div>
        );
      case 'synapse':
        return (
          <div className="reference-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div className="reference-item" style={{ cursor: 'default' }}>
              <h5 style={{ color: '#00a4ef', fontSize: '0.8rem', fontWeight: 600 }}>Warehouse Star Schema</h5>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.3' }}>
                Tables structured inside PostgreSQL:
              </p>
              <ul style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', paddingLeft: '1rem', marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <li><code>dw.dim_customers</code>: Customer demographics</li>
                <li><code>dw.dim_merchants</code>: Merchant business tags</li>
                <li><code>dw.fact_orders</code>: Batch order items</li>
                <li><code>dw.fact_transactions</code>: Real-time streams</li>
              </ul>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Open notebooks to query warehouse tables:
            </p>
            <button 
              className="btn btn-secondary" 
              onClick={() => loadNotebook('synapse_features_demo.ipynb')}
              style={{ fontSize: '0.75rem', padding: '0.4rem', justifyContent: 'flex-start', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <Sparkles size={12} style={{ color: '#00a4ef' }} />
              Open Synapse Features Notebook
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => loadNotebook('dw_tables.ipynb')}
              style={{ fontSize: '0.75rem', padding: '0.4rem', justifyContent: 'flex-start', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <Sparkles size={12} style={{ color: '#00a4ef' }} />
              Open DW Star Schema Notebook
            </button>
          </div>
        );
      case 'datalake':
        return (
          <div className="reference-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div className="reference-item" style={{ cursor: 'default' }}>
              <h5 style={{ color: '#0078d4', fontSize: '0.8rem', fontWeight: 600 }}>S3 / ADLS Gen2 Storage Zones</h5>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.3' }}>
                Organized MinIO buckets:
              </p>
              <ul style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', paddingLeft: '1rem', marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <li><code>bronze/</code>: Ingested raw datasets</li>
                <li><code>silver/</code>: Cleaned & partitioned tables</li>
                <li><code>gold/</code>: Aggregated marts</li>
                <li><code>warehouse/</code>: Default Spark catalog</li>
              </ul>
            </div>
            <button 
              className="btn btn-secondary" 
              onClick={() => loadNotebook('Medallion_Architecture_TPCH.ipynb')}
              style={{ fontSize: '0.75rem', padding: '0.4rem', justifyContent: 'flex-start', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <Sparkles size={12} style={{ color: '#0078d4' }} />
              Open Medallion Pipeline Notebook
            </button>
          </div>
        );
      case 'eventhub':
        return (
          <div className="reference-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div className="reference-item" style={{ cursor: 'default' }}>
              <h5 style={{ color: '#ffb900', fontSize: '0.8rem', fontWeight: 600 }}>Active Stream Topics</h5>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.3' }}>
                Real-time Kafka streams in Redpanda:
              </p>
              <ul style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', paddingLeft: '1rem', marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <li><code>telemetry-transactions</code>: Telemetry streams</li>
                <li><code>cdc-database-events</code>: Database CDC logs</li>
              </ul>
            </div>
            <button 
              className="btn btn-secondary" 
              onClick={() => loadNotebook('project2_eventhub_streaming.ipynb')}
              style={{ fontSize: '0.75rem', padding: '0.4rem', justifyContent: 'flex-start', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <Sparkles size={12} style={{ color: '#ffb900' }} />
              Open Event Hub Consumer
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => loadNotebook('project4_cdc_pipeline.ipynb')}
              style={{ fontSize: '0.75rem', padding: '0.4rem', justifyContent: 'flex-start', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <Sparkles size={12} style={{ color: '#ffb900' }} />
              Open CDC Consumer Notebook
            </button>
          </div>
        );
      case 'servicebus':
        return (
          <div className="reference-list">
            <div className="reference-item" style={{ cursor: 'default' }}>
              <h5 style={{ color: '#ff5f00', fontSize: '0.8rem', fontWeight: 600 }}>Message Queues</h5>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
                RabbitMQ acts as the Service Bus broker.
              </p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
                The active queue is <code>order-processing-queue</code>. It buffers incoming order payloads for downstream consumers.
              </p>
            </div>
          </div>
        );
      case 'monitoring':
        return (
          <div className="reference-list">
            <div className="reference-item" style={{ cursor: 'default' }}>
              <h5 style={{ color: '#7fba00', fontSize: '0.8rem', fontWeight: 600 }}>Grafana Metrics</h5>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
                Simulates Azure Monitor telemetry.
              </p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
                Collects CPU and Memory load details from all 13 Docker containers running in the local practice ecosystem.
              </p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // Render Service Iframe View
  const renderIframeView = (key) => {
    const service = services[key];
    const themeColor = SERVICE_THEMES[key];
    const credentials = SERVICE_CREDENTIALS[key];
    
    if (!service) return null;
    
    const isOnline = service.status === 'online';
    const isAdmin = user.role === 'admin';
    const currentUrl = iframeUrl[key] || PROXIED_SERVICE_URLS[key] || service.ui_url;
    const activeSubTab = workspaceTabs[key] || "practice";

    return (
      <div className="workspace-layout">
        {/* Left Resource & Documentation panel */}
        <aside className="workspace-sidebar">
          <div className="workspace-sidebar-header" style={{ borderBottom: `2px solid ${themeColor}` }}>
            <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
              <div style={{
                background: `rgba(${parseInt(themeColor.slice(1,3), 16)}, ${parseInt(themeColor.slice(3,5), 16)}, ${parseInt(themeColor.slice(5,7), 16)}, 0.1)`,
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center'
              }}>
                {React.createElement(SERVICE_ICONS[key] || Server, { size: 18, style: { color: themeColor } })}
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', color: '#ffffff' }}>{service.name}</h3>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{service.container_name}</span>
              </div>
            </div>
            <div className={`status-badge ${service.status}`} style={{ fontSize: '0.6rem', padding: '2px 6px' }}>
              {service.status}
            </div>
          </div>

          {/* Switch Tabs: Reference vs AI Copilot */}
          <div className="copilot-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border-glass)', marginBottom: '1rem', paddingBottom: '0.25rem', flexShrink: 0 }}>
            <button 
              onClick={() => setWorkspaceTabs(prev => ({ ...prev, [key]: "practice" }))}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                color: activeSubTab === 'practice' ? '#ffffff' : 'var(--text-secondary)',
                borderBottom: activeSubTab === 'practice' ? `2px solid ${themeColor}` : '2px solid transparent',
                padding: '0.4rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Practice
            </button>
            <button 
              onClick={() => setWorkspaceTabs(prev => ({ ...prev, [key]: "copilot" }))}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                color: activeSubTab === 'copilot' ? '#ffffff' : 'var(--text-secondary)',
                borderBottom: activeSubTab === 'copilot' ? '2px solid #ffb900' : '2px solid transparent',
                padding: '0.4rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              <Sparkles size={12} style={{ color: '#ffb900' }} />
              AI Copilot
            </button>
          </div>

          {/* Conditional body view depending on active sub tab */}
          {activeSubTab === "practice" ? (
            <>
              {/* Metrics */}
              <div className="workspace-sidebar-section">
                <h4 className="section-subtitle">Resource Utilization</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div className="metric-row">
                    <div className="metric-label" style={{ fontSize: '0.7rem' }}>
                      <span>CPU Usage</span>
                      <span>{service.cpu_usage}</span>
                    </div>
                    <div className="progress-bar-container">
                      <div className="progress-bar-fill" style={{ width: service.cpu_usage, '--theme-color': themeColor }}></div>
                    </div>
                  </div>
                  <div className="metric-row">
                    <div className="metric-label" style={{ fontSize: '0.7rem' }}>
                      <span>RAM ({service.memory_usage})</span>
                      <span>{service.memory_percent}</span>
                    </div>
                    <div className="progress-bar-container">
                      <div className="progress-bar-fill" style={{ width: service.memory_percent, '--theme-color': themeColor }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Connection Access credentials */}
              <div className="workspace-sidebar-section">
                <h4 className="section-subtitle">Authentication</h4>
                <div className="iframe-credentials" style={{ width: '100%' }}>
                  <Key size={13} />
                  <span>Integration Status: <strong>Passwordless</strong></span>
                </div>
                {credentials && credentials !== "No login needed" && (
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    Fallback credentials: <code>{credentials}</code>
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div className="workspace-sidebar-section">
                <h4 className="section-subtitle">Workspace Controls</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <button 
                    onClick={() => setIframeUrl(prev => ({ ...prev, [key]: PROXIED_SERVICE_URLS[key] }))}
                    className="btn btn-primary"
                    style={{ '--theme-color': themeColor, width: '100%', fontSize: '0.75rem', padding: '0.4rem' }}
                    disabled={!isOnline}
                  >
                    <RefreshCw size={12} />
                    Reset Console
                  </button>

                  {isAdmin && !isOnline && (
                    <button 
                      className="btn btn-primary" 
                      style={{ '--theme-color': themeColor, width: '100%', padding: '0.4rem', fontSize: '0.75rem' }}
                      onClick={() => handleStart(key)}
                      disabled={actionLoading[key] !== null}
                    >
                      <Play size={12} fill="currentColor" />
                      {actionLoading[key] === 'starting' ? 'Starting...' : 'Start Container'}
                    </button>
                  )}

                  {isAdmin && isOnline && (
                    <button 
                      className="btn btn-danger" 
                      style={{ width: '100%', padding: '0.4rem', fontSize: '0.75rem' }}
                      onClick={() => handleStop(key)}
                      disabled={actionLoading[key] !== null}
                    >
                      <Square size={12} fill="currentColor" />
                      {actionLoading[key] === 'stopping' ? 'Stopping...' : 'Stop Container'}
                    </button>
                  )}

                  <a 
                    href={service.ui_url} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn btn-secondary"
                    style={{ width: '100%', fontSize: '0.75rem', padding: '0.4rem' }}
                  >
                    <ExternalLink size={12} />
                    Open External Tab
                  </a>
                </div>
              </div>

              {/* Reference panel */}
              <div className="workspace-sidebar-section reference-section" style={{ flexGrow: 1, overflowY: 'auto' }}>
                <h4 className="section-subtitle">Practice Resources</h4>
                {renderServiceReferences(key)}
              </div>
            </>
          ) : (
            /* AI Copilot View */
            <div className="copilot-chat-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0.75rem', flexGrow: 1, overflowY: 'auto' }}>
              {/* Settings Key widget */}
              <div className="workspace-sidebar-section" style={{ marginBottom: '0.5rem' }}>
                <h4 className="section-subtitle">AI Authentication</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(0,0,0,0.2)', padding: '0.35rem 0.5rem', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                  <Key size={12} style={{ color: geminiKey ? '#ffb900' : 'var(--text-secondary)' }} />
                  <input 
                    type="password"
                    placeholder="Enter Gemini API Key..."
                    value={geminiKey}
                    onChange={e => {
                      setGeminiKey(e.target.value);
                      localStorage.setItem('gemini_api_key', e.target.value);
                    }}
                    style={{ background: 'none', border: 'none', color: '#ffffff', outline: 'none', fontSize: '0.72rem', width: '100%' }}
                  />
                </div>
              </div>

              {/* Preset buttons */}
              <div className="workspace-sidebar-section" style={{ marginBottom: '0.5rem' }}>
                <h4 className="section-subtitle">Smart Preset Queries</h4>
                <div className="copilot-shortcuts" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                  {key === 'databricks' && (
                    <>
                      <button onClick={() => handleCopilotSubmit(key, "validate_code")} className="btn btn-secondary" style={{ fontSize: '0.68rem', padding: '0.35rem', justifyContent: 'center' }}>🔧 Fix Code Syntax</button>
                      <button onClick={() => handleCopilotSubmit(key, "generate_code", "Write a PySpark Delta Lake MERGE statement")} className="btn btn-secondary" style={{ fontSize: '0.68rem', padding: '0.35rem', justifyContent: 'center' }}>⚡ Delta MERGE</button>
                    </>
                  )}
                  {key === 'airflow' && (
                    <>
                      <button onClick={() => handleCopilotSubmit(key, "validate_code")} className="btn btn-secondary" style={{ fontSize: '0.68rem', padding: '0.35rem', justifyContent: 'center' }}>🔧 Check DAG Syntax</button>
                      <button onClick={() => handleCopilotSubmit(key, "generate_code", "Write an Airflow pipeline scheduling 2 tasks sequentially")} className="btn btn-secondary" style={{ fontSize: '0.68rem', padding: '0.35rem', justifyContent: 'center' }}>⚡ Sequence DAG</button>
                    </>
                  )}
                  {key === 'synapse' && (
                    <>
                      <button onClick={() => handleCopilotSubmit(key, "generate_code", "Generate schema DDL for customer dimension and order fact tables in Star schema")} className="btn btn-secondary" style={{ fontSize: '0.68rem', padding: '0.35rem', justifyContent: 'center' }}>⚡ Star Schema DDL</button>
                      <button onClick={() => handleCopilotSubmit(key, "general", "Explain query optimization techniques in Postgres")} className="btn btn-secondary" style={{ fontSize: '0.68rem', padding: '0.35rem', justifyContent: 'center' }}>📈 Query Optimize</button>
                    </>
                  )}
                  {key === 'datalake' && (
                    <>
                      <button onClick={() => handleCopilotSubmit(key, "validate_data")} className="btn btn-secondary" style={{ fontSize: '0.68rem', padding: '0.35rem', justifyContent: 'center' }}>🔍 Validate Dataset</button>
                      <button onClick={() => handleCopilotSubmit(key, "generate_code", "Write a Python script using boto3 to upload raw transactions to MinIO bronze bucket")} className="btn btn-secondary" style={{ fontSize: '0.68rem', padding: '0.35rem', justifyContent: 'center' }}>⚡ Ingest Script</button>
                    </>
                  )}
                  {!['databricks', 'airflow', 'synapse', 'datalake'].includes(key) && (
                    <>
                      <button onClick={() => handleCopilotSubmit(key, "generate_code", `Write a Python client template to connect to ${key === 'eventhub' ? 'Redpanda (Kafka)' : key === 'servicebus' ? 'RabbitMQ' : 'Grafana'}`)} className="btn btn-secondary" style={{ fontSize: '0.68rem', padding: '0.35rem', justifyContent: 'center' }}>⚡ Code Template</button>
                      <button onClick={() => handleCopilotSubmit(key, "general", `Explain connection integration patterns for ${service.name}`)} className="btn btn-secondary" style={{ fontSize: '0.68rem', padding: '0.35rem', justifyContent: 'center' }}>ℹ️ Explain Patterns</button>
                    </>
                  )}
                </div>
              </div>

              {/* Text Area */}
              <div className="workspace-sidebar-section" style={{ marginBottom: '0.5rem' }}>
                <h4 className="section-subtitle">Ask Copilot</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <textarea
                    className="form-input"
                    placeholder={
                      key === 'datalake' ? "Paste CSV/JSON data to validate..." :
                      key === 'databricks' ? "Paste PySpark/SQL script here to validate or describe code to generate..." :
                      "Enter your prompt or paste code here..."
                    }
                    value={copilotInput[key] || ""}
                    onChange={e => setCopilotInput(prev => ({ ...prev, [key]: e.target.value }))}
                    style={{ height: '70px', resize: 'none', fontSize: '0.75rem', padding: '0.4rem', background: '#0e162b', color: '#ffffff', borderRadius: '8px', border: '1px solid var(--border-glass)' }}
                  />
                  <button
                    onClick={() => handleCopilotSubmit(key, "general")}
                    className="btn btn-primary"
                    style={{ '--theme-color': '#ffb900', color: '#080c16', width: '100%', fontSize: '0.75rem', padding: '0.4rem', fontWeight: 'bold' }}
                    disabled={copilotLoading[key]}
                  >
                    {copilotLoading[key] ? "🧠 Thinking..." : "Ask AI Copilot"}
                  </button>
                </div>
              </div>

              {/* AI Response */}
              <div className="workspace-sidebar-section" style={{ flexGrow: 1, minHeight: '180px', display: 'flex', flexDirection: 'column' }}>
                <h4 className="section-subtitle">Copilot Response</h4>
                <div className="copilot-response" style={{ flexGrow: 1, minHeight: '120px', overflowY: 'auto', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {copilotResponse[key] ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {renderMarkdown(copilotResponse[key])}
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', margin: 'auto' }}>
                      No active query. Try preset buttons or enter a custom prompt above.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Right Iframe Panel */}
        <div className="workspace-main">
          {isOnline ? (
            <iframe 
              src={currentUrl} 
              className="iframe-body" 
              title={service.name} 
              key={`${key}-${currentUrl}`}
            />
          ) : (
            <div className="iframe-fallback-overlay">
              <h3>Workspace Console Offline</h3>
              <p style={{ fontSize: '0.85rem', margin: '0.5rem 0 1rem 0', maxWidth: '400px' }}>
                The service <strong>{service.name}</strong> container is currently stopped.
              </p>
              {isAdmin && (
                <button 
                  className="btn btn-primary" 
                  style={{ '--theme-color': themeColor, width: '160px', padding: '0.6rem', fontSize: '0.8rem' }}
                  onClick={() => handleStart(key)}
                  disabled={actionLoading[key] !== null}
                >
                  <Play size={13} fill="currentColor" />
                  {actionLoading[key] === 'starting' ? 'Starting...' : 'Start Service'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };


  // Render Dashboard View
  const renderDashboardView = () => {
    const isAdmin = user.role === 'admin';
    return (
      <div className="portal-container">
        {/* Header Section */}
        <header className="portal-header">
          <div className="header-title">
            <h1>Azure Practice Lab Console</h1>
            <p>Logged in as: <strong style={{ color: '#60a5fa' }}>{user.username}</strong> ({user.role})</p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="system-status-summary" style={{ gap: '0.5rem' }}>
              <Key size={14} style={{ color: geminiKey ? '#ffb900' : 'var(--text-secondary)' }} />
              <input 
                type="password"
                placeholder="Gemini API Key"
                value={geminiKey}
                onChange={e => {
                  setGeminiKey(e.target.value);
                  localStorage.setItem('gemini_api_key', e.target.value);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ffffff',
                  outline: 'none',
                  fontSize: '0.78rem',
                  width: '120px'
                }}
              />
            </div>

            <div className="system-status-summary">
              <Server size={16} className="text-secondary" />
              <span>Running Services: <strong>{getActiveCount()}/7</strong></span>
              <div className={`status-dot ${getActiveCount() > 0 ? 'active' : 'inactive'}`}></div>
              <button 
                className="btn btn-secondary btn-icon-only" 
                onClick={fetchServices} 
                style={{ marginLeft: '8px' }}
                title="Refresh status"
              >
                <RefreshCw size={14} />
              </button>
            </div>
            
            <button className="btn btn-danger" onClick={handleLogout} style={{ padding: '0.5rem 1rem', borderRadius: '10px' }}>
              <LogOut size={14} />
              Log Out
            </button>
          </div>
        </header>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#f87171',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            padding: '1rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            fontWeight: 500
          }}>
            ⚠️ {error}
          </div>
        )}

        {loading && Object.keys(services).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}>
            <RefreshCw className="animate-spin" size={28} />
            <p style={{ marginTop: '1rem' }}>Loading workspace components...</p>
          </div>
        ) : (
          <div className="cards-grid">
            {Object.entries(services).map(([key, service]) => {
              const Icon = SERVICE_ICONS[key] || Server;
              const themeColor = SERVICE_THEMES[key] || '#0078d4';
              const isOnline = service.status === 'online';
              const inAction = actionLoading[key];

              const cpuVal = parseFloat(service.cpu_usage) || 0;
              const memVal = parseFloat(service.memory_percent) || 0;

              return (
                <div 
                  key={key} 
                  className="service-card" 
                  style={{ '--theme-color': themeColor }}
                >
                  <div>
                    <div className="card-header">
                      <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                        <div style={{
                          background: `rgba(${parseInt(themeColor.slice(1,3), 16)}, ${parseInt(themeColor.slice(3,5), 16)}, ${parseInt(themeColor.slice(5,7), 16)}, 0.1)`,
                          padding: '8px',
                          borderRadius: '10px',
                          border: `1px solid rgba(${parseInt(themeColor.slice(1,3), 16)}, ${parseInt(themeColor.slice(3,5), 16)}, ${parseInt(themeColor.slice(5,7), 16)}, 0.2)`
                        }}>
                          <Icon size={18} style={{ color: themeColor }} />
                        </div>
                        <div className="service-info">
                          <h3 style={{ fontSize: '1.1rem' }}>{service.name}</h3>
                          <span>{service.container_name}</span>
                        </div>
                      </div>
                      <div className={`status-badge ${service.status}`} style={{ fontSize: '0.65rem' }}>
                        {service.status}
                      </div>
                    </div>

                    <div className="metrics-container">
                      <div className="metric-row">
                        <div className="metric-label">
                          <span>CPU Usage</span>
                          <span className="metric-value">{service.cpu_usage}</span>
                        </div>
                        <div className="progress-bar-container">
                          <div 
                            className="progress-bar-fill" 
                            style={{ width: `${Math.min(cpuVal, 100)}%`, '--theme-color': themeColor }}
                          ></div>
                        </div>
                      </div>

                      <div className="metric-row">
                        <div className="metric-label">
                          <span>RAM ({service.memory_usage} / {service.memory_limit})</span>
                          <span className="metric-value">{service.memory_percent}</span>
                        </div>
                        <div className="progress-bar-container">
                          <div 
                            className="progress-bar-fill" 
                            style={{ width: `${Math.min(memVal, 100)}%`, '--theme-color': themeColor }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="controls-container">
                    {isOnline ? (
                      <>
                        {isAdmin ? (
                          <button 
                            className="btn btn-danger" 
                            onClick={() => handleStop(key)}
                            disabled={inAction !== null}
                          >
                            <Square size={12} fill="currentColor" />
                            {inAction === 'stopping' ? 'Stopping...' : 'Stop'}
                          </button>
                        ) : (
                          <div className="btn btn-secondary" style={{ opacity: 0.5, cursor: 'default', pointerEvents: 'none' }}>
                            <Lock size={12} />
                            Read-Only
                          </div>
                        )}
                        <button 
                          onClick={() => setActiveTab(key)} 
                          className="btn btn-secondary"
                        >
                          <ExternalLink size={12} />
                          Console
                        </button>
                      </>
                    ) : (
                      <>
                        {isAdmin ? (
                          <button 
                            className="btn btn-primary" 
                            onClick={() => handleStart(key)}
                            disabled={inAction !== null}
                            style={{ '--theme-color': themeColor }}
                          >
                            <Play size={12} fill="currentColor" />
                            {inAction === 'starting' ? 'Starting...' : 'Start'}
                          </button>
                        ) : (
                          <button 
                            className="btn btn-primary" 
                            style={{ '--theme-color': themeColor, opacity: 0.5, cursor: 'not-allowed' }}
                            disabled
                          >
                            Offline
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Practice Projects */}
        <section className="info-section">
          <h2 className="section-title">Pre-Built Data Engineering Labs</h2>
          <div className="projects-grid">
            <div className="project-item">
              <div className="project-tag">Project 1 • Batch ETL</div>
              <h4>ADF → ADLS → Databricks → Synapse</h4>
              <p>Ingests customer and order datasets from raw CSV files into MinIO Bronze, processes cleaning transformations to Silver, performs business aggregates in Gold using Spark, and saves the final analytical reports to PostgreSQL.</p>
            </div>
            <div className="project-item">
              <div className="project-tag">Project 2 • Streaming</div>
              <h4>Event Hub → Databricks Streaming</h4>
              <p>Ingests telemetry transactions from Redpanda (Event Hub) via PySpark Structured Streaming. Parses logs dynamically and appends them to structured Delta Lake tables with full transaction log history.</p>
            </div>
            <div className="project-item">
              <div className="project-tag">Project 3 • Incremental</div>
              <h4>ADF Incremental Pipeline</h4>
              <p>Orchestrates micro-batch REST API requests from the FastAPI backend. Determines lookup checkpoints, retrieves new transaction chunks, loads raw stages, and runs a DELTA MERGE upsert statement.</p>
            </div>
            <div className="project-item">
              <div className="project-tag">Project 4 • CDC Feed</div>
              <h4>Postgres Source → Event Hub → Spark</h4>
              <p>Simulates real-time Change Data Capture (CDC) events from transactional PostgreSQL databases. Publishes INSERTs/UPDATEs onto a streaming message topic to keep target warehouses updated.</p>
            </div>
          </div>
        </section>
      </div>
    );
  };

  // Render User Management View
  const renderUserManagementView = () => {
    const nonAdminCount = userList.filter(u => u.role !== 'admin').length;
    
    return (
      <div className="portal-container" style={{ maxWidth: '900px' }}>
        <header className="portal-header">
          <div className="header-title">
            <h1>User Management</h1>
            <p>Admin Control Console</p>
          </div>
          <button className="btn btn-secondary" onClick={() => setActiveTab('dashboard')} style={{ padding: '0.5rem 1rem', borderRadius: '10px' }}>
            Back to Dashboard
          </button>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '2rem', alignItems: 'start' }}>
          
          {/* Create User Form */}
          <form className="user-manager-card" onSubmit={handleCreateUser}>
            <h3 style={{ marginBottom: '1.25rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserCheck size={18} style={{ color: '#0078d4' }} />
              Create New User
            </h3>

            {createUserError && (
              <div style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', padding: '0.5rem', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '1rem' }}>
                ⚠️ {createUserError}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Username</label>
              <input 
                type="text" 
                className="form-input"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                placeholder="e.g. jsmith"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Password</label>
              <input 
                type="password" 
                className="form-input"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Password"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label>Role</label>
              <select 
                className="form-input" 
                value={newRole}
                onChange={e => setNewRole(e.target.value)}
                style={{ background: '#0e162b', color: '#ffffff' }}
              >
                <option value="user">Limited (Read-Only Viewer)</option>
                <option value="admin">Admin (Full access)</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary" style={{ '--theme-color': '#0078d4', width: '100%', padding: '0.75rem', borderRadius: '10px' }}>
              Create User
            </button>
          </form>

          {/* User List Table */}
          <div className="user-manager-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={18} style={{ color: '#60a5fa' }} />
                Active Users
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Limited access users: <strong>{nonAdminCount} / 20</strong>
              </span>
            </div>

            <table className="users-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {userList.map(u => (
                  <tr key={u.username}>
                    <td style={{ fontWeight: 600, color: '#ffffff' }}>{u.username}</td>
                    <td>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        padding: '2px 8px', 
                        borderRadius: '10px',
                        background: u.role === 'admin' ? 'rgba(0, 120, 212, 0.15)' : 'rgba(255,255,255,0.05)',
                        color: u.role === 'admin' ? '#60a5fa' : 'var(--text-secondary)',
                        fontWeight: 600
                      }}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      {["aariz", "ariz"].includes(u.username) ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>System Default</span>
                      ) : (
                        <button 
                          onClick={() => handleDeleteUser(u.username)}
                          style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          title="Delete user"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    );
  };

  return (
    <div className="app-wrapper">
      {renderSidebar()}
      <main className="main-content">
        {activeTab === 'dashboard' ? renderDashboardView() : 
         activeTab === 'users' ? renderUserManagementView() : 
         renderIframeView(activeTab)}
      </main>
    </div>
  );
}
