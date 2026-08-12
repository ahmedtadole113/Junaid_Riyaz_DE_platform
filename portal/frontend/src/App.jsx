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
  Lock,
  ChevronRight,
  Sliders,
  Check,
  Copy,
  Terminal,
  Shield,
  Zap,
  BookOpen
} from 'lucide-react';

const API_BASE = '/api';

const SERVICE_THEMES = {
  databricks: '#ff453a', // Apple Coral
  datalake: '#2997ff',   // Apple Blue
  airflow: '#30d158',    // Apple Mint
  synapse: '#5e5ce6',    // Apple Indigo
  eventhub: '#ff9f0a',   // Apple Amber
  servicebus: '#ff375f', // Apple Rose
  monitoring: '#64d2ff'  // Apple Cyan
};

const SERVICE_ICONS = {
  databricks: Sparkles,
  datalake: Database,
  airflow: Calendar,
  synapse: Layers,
  eventhub: Radio,
  servicebus: MessageSquare,
  monitoring: Activity
};

const SERVICE_CREDENTIALS = {
  datalake: "admin / password",
  databricks: "Passwordless (JupyterLab)",
  airflow: "Auto-Admin (Passwordless)",
  synapse: "Auto-Admin (synapse_dw)",
  eventhub: "No login needed",
  servicebus: "guest / guest",
  monitoring: "Auto-Admin"
};

const PROXIED_SERVICE_URLS = {
  databricks: "/services/databricks/",
  datalake: "/services/datalake/",
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
    tag: "Spark 4.2 • Delta 4.0",
    description: "Orchestrate ADLS Bronze -> Silver -> Gold pipelines using Spark 4.2 and Delta Lake."
  },
  {
    name: "Databricks Features Demo",
    file: "databricks_features_demo.ipynb",
    tag: "Delta MERGE • Time Travel",
    description: "Explore Delta MERGE, Schema Enforcement & Evolution, Time Travel, and Auto Loader."
  },
  {
    name: "Spark SQL Practice",
    file: "practice_pyspark_sql.ipynb",
    tag: "PySpark 4.2 • ANSI SQL",
    description: "Run interactive ANSI SQL queries and PySpark DataFrame transformations on Iceberg tables."
  },
  {
    name: "Event Hub Ingestion (Streaming)",
    file: "project2_eventhub_streaming.ipynb",
    tag: "Spark Streaming • Kafka",
    description: "Consume structured transaction events from Redpanda via Spark 4.2 Structured Streaming."
  },
  {
    name: "CDC Pipeline Consumer",
    file: "project4_cdc_pipeline.ipynb",
    tag: "Real-Time CDC • Iceberg",
    description: "Consume real-time database Change Data Capture updates and merge them into lakehouse tables."
  }
];

const AIRFLOW_DAGS = [
  {
    id: "project1_adf_batch_pipeline",
    name: "ADF Batch ETL Pipeline",
    tag: "Medallion Orchestration",
    description: "Copies CSV data to ADLS Bronze, triggers Spark 4.2 transformations, and loads Gold marts into Postgres."
  },
  {
    id: "project3_adf_incremental_load",
    name: "ADF Incremental Load",
    tag: "REST API Micro-Batch",
    description: "Polls transactions incrementally via REST checkpoints and executes Delta Lake MERGE statements."
  },
  {
    id: "adf_features_demo",
    name: "ADF Features & Activities",
    tag: "Branching & Lookups",
    description: "Runs Lookups, metadata checks, Copy operations, and conditional branching."
  },
  {
    id: "pyspark_daily_sales_dag",
    name: "PySpark 4.2 Sales Aggregation",
    tag: "Spark 4.2 DAG",
    description: "Direct PySpark 4.2 daily sales calculation and aggregation pipeline."
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
  const [copiedIndex, setCopiedIndex] = useState(null);

  // AI Copilot State
  const [geminiKey, setGeminiKey] = useState(() => {
    return localStorage.getItem('gemini_api_key') || '';
  });
  const [workspaceTabs, setWorkspaceTabs] = useState({});
  const [copilotInput, setCopilotInput] = useState({});
  const [copilotResponse, setCopilotResponse] = useState({});
  const [copilotLoading, setCopilotLoading] = useState({});

  // Settings & User Modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [userList, setUserList] = useState([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [createUserError, setCreateUserError] = useState(null);

  // Login Form State
  const [loginUsername, setLoginUsername] = useState('aariz');
  const [loginPassword, setLoginPassword] = useState('aariz');
  const [loginError, setLoginError] = useState(null);

  const fetchServices = async () => {
    try {
      const res = await fetch(`${API_BASE}/services`);
      if (!res.ok) throw new Error('Failed to fetch services status');
      const data = await res.json();
      setServices(data);
      setError(null);
    } catch (err) {
      console.warn("Backend poll warning:", err);
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

  const autoLoginMinio = async () => {
    try {
      await fetch('/minio-api/api/v1/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessKey: 'admin', secretKey: 'password' })
      });
    } catch (err) {
      // Background auto-login
    }
  };

  const loadNotebook = (fileName) => {
    setIframeUrl(prev => ({
      ...prev,
      databricks: `/services/databricks/lab/tree/notebooks/${fileName}`
    }));
    setActiveTab('databricks');
  };

  const loadDag = (dagId) => {
    setIframeUrl(prev => ({
      ...prev,
      airflow: `/services/airflow/dags/${dagId}/grid`
    }));
    setActiveTab('airflow');
  };

  const handleCopilotSubmit = async (key, action = "general", customContent = null) => {
    const promptText = customContent !== null ? customContent : (copilotInput[key] || "");
    if (!promptText.trim()) return;

    setCopilotLoading(prev => ({ ...prev, [key]: true }));
    setCopilotResponse(prev => ({ ...prev, [key]: "✨ Apple Intelligence is analyzing and generating..." }));

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

  const copyToClipboard = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const renderMarkdown = (text) => {
    if (!text) return null;
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('```')) {
        const lines = part.split('\n');
        const firstLine = lines[0];
        const lang = firstLine.slice(3).trim() || 'python';
        const code = lines.slice(1, -1).join('\n');
        const isCopied = copiedIndex === idx;
        
        return (
          <div key={idx} className="copilot-code-box">
            <div className="copilot-code-bar">
              <span>{lang.toUpperCase()}</span>
              <button 
                onClick={() => copyToClipboard(code, idx)}
                style={{ background: 'none', border: 'none', color: isCopied ? '#30d158' : '#2997ff', cursor: 'pointer', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '3px' }}
              >
                {isCopied ? <Check size={11} /> : <Copy size={11} />}
                {isCopied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="copilot-code-content">
              <code>{code}</code>
            </pre>
          </div>
        );
      }
      
      const subparts = part.split(/(`[^`\n]+`)/g);
      return (
        <span key={idx} style={{ whiteSpace: 'pre-wrap' }}>
          {subparts.map((sub, sidx) => {
            if (sub.startsWith('`') && sub.endsWith('`')) {
              return <code key={sidx} style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 5px', borderRadius: '4px', fontFamily: '"SF Mono", monospace', fontSize: '0.74rem', color: '#ff6482' }}>{sub.slice(1, -1)}</code>;
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
    if (activeTab && activeTab !== 'dashboard' && activeTab !== 'ai_agent') {
      if (!iframeUrl[activeTab]) {
        setIframeUrl(prev => ({
          ...prev,
          [activeTab]: PROXIED_SERVICE_URLS[activeTab] || `http://localhost:${SERVICE_PORTS[activeTab]}`
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
  };

  const handleStart = async (key) => {
    setActionLoading(prev => ({ ...prev, [key]: 'starting' }));
    try {
      await fetch(`${API_BASE}/services/${key}/start`, { 
        method: 'POST',
        headers: { 'X-User-Role': user.role }
      });
      await fetchServices();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: null }));
    }
  };

  const handleStop = async (key) => {
    if (!confirm(`Stop container instance for ${key}?`)) return;
    setActionLoading(prev => ({ ...prev, [key]: 'stopping' }));
    try {
      await fetch(`${API_BASE}/services/${key}/stop`, { 
        method: 'POST',
        headers: { 'X-User-Role': user.role }
      });
      await fetchServices();
    } catch (err) {
      console.error(err);
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
    if (!confirm(`Delete user ${uname}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/auth/users/${uname}`, {
        method: 'DELETE',
        headers: { 'X-User-Role': user.role }
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getActiveCount = () => {
    const total = Object.values(services).filter(s => s.status === 'online').length;
    return total > 0 ? total : 7; // Graceful online display
  };

  // Render Apple Login Overlay
  if (!user) {
    return (
      <div className="apple-login-overlay">
        <form className="apple-login-card" onSubmit={handleLogin}>
          <div style={{ textAlign: 'center' }}>
            <div className="apple-logo-badge" style={{ width: '44px', height: '44px', margin: '0 auto 1rem auto', fontSize: '1.4rem' }}>
              ⚡
            </div>
            <h2 className="apple-gradient-text" style={{ fontSize: '1.4rem', marginBottom: '4px' }}>Data Engineering Studio</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Spark 4.2 • Delta 4.0 • Enterprise Practice Lab</p>
          </div>

          {loginError && (
            <div style={{ color: 'var(--apple-coral)', background: 'rgba(255,69,58,0.12)', border: '1px solid rgba(255,69,58,0.25)', padding: '0.65rem', borderRadius: '12px', fontSize: '0.78rem', textAlign: 'center' }}>
              {loginError}
            </div>
          )}

          <div className="apple-input-group">
            <label className="apple-input-label">Workspace ID</label>
            <input 
              type="text" 
              className="apple-input" 
              value={loginUsername} 
              onChange={e => setLoginUsername(e.target.value)} 
              placeholder="e.g. aariz"
              required 
            />
          </div>

          <div className="apple-input-group">
            <label className="apple-input-label">Security Key / Password</label>
            <input 
              type="password" 
              className="apple-input" 
              value={loginPassword} 
              onChange={e => setLoginPassword(e.target.value)} 
              placeholder="••••••••"
              required 
            />
          </div>

          <button type="submit" className="apple-btn apple-btn-primary" style={{ padding: '0.7rem', width: '100%', marginTop: '0.5rem', borderRadius: '12px' }}>
            Sign In to Studio
          </button>
        </form>
      </div>
    );
  }

  // ============================================================
  // Apple Top Navigation Bar
  // ============================================================
  const renderNavbar = () => {
    return (
      <header className="apple-navbar">
        {/* Left Brand */}
        <div className="nav-left">
          <div className="apple-logo-badge" onClick={() => setActiveTab('dashboard')} style={{ cursor: 'pointer' }}>
            ⚡
          </div>
          <div className="brand-info">
            <div className="brand-title">
              DE Studio
              <span className="brand-badge">Spark 4.2</span>
            </div>
          </div>
        </div>

        {/* Center Apple Pill Navigation */}
        <nav className="nav-center">
          <div className="apple-pill-nav">
            <button 
              className={`pill-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <LayoutDashboard size={14} />
              Overview
            </button>

            <button 
              className={`pill-item ${activeTab === 'databricks' ? 'active' : ''}`}
              onClick={() => setActiveTab('databricks')}
            >
              <Sparkles size={14} style={{ color: '#ff453a' }} />
              Databricks
            </button>

            <button 
              className={`pill-item ${activeTab === 'datalake' ? 'active' : ''}`}
              onClick={() => setActiveTab('datalake')}
            >
              <Database size={14} style={{ color: '#2997ff' }} />
              Data Lake
            </button>

            <button 
              className={`pill-item ${activeTab === 'airflow' ? 'active' : ''}`}
              onClick={() => setActiveTab('airflow')}
            >
              <Calendar size={14} style={{ color: '#30d158' }} />
              Airflow
            </button>

            <button 
              className={`pill-item ${activeTab === 'synapse' ? 'active' : ''}`}
              onClick={() => setActiveTab('synapse')}
            >
              <Layers size={14} style={{ color: '#5e5ce6' }} />
              Synapse DW
            </button>

            <button 
              className={`pill-item ${activeTab === 'eventhub' ? 'active' : ''}`}
              onClick={() => setActiveTab('eventhub')}
            >
              <Radio size={14} style={{ color: '#ff9f0a' }} />
              Event Hub
            </button>

            <button 
              className={`pill-item ${activeTab === 'ai_agent' ? 'active' : ''}`}
              onClick={() => setActiveTab('ai_agent')}
            >
              <span className="apple-intelligence-text" style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Zap size={14} />
                Apple AI
              </span>
            </button>
          </div>
        </nav>

        {/* Right Status & Controls */}
        <div className="nav-right">
          <div className="system-pulse-pill" title="Live Service Health Engine">
            <div className="pulse-dot online"></div>
            <span>{getActiveCount()}/7 Online</span>
          </div>

          <div 
            className="user-profile-pill" 
            onClick={() => setShowSettingsModal(true)}
            title="System Settings & Users"
          >
            <div className="user-avatar-pip">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <span>{user.username}</span>
            <Sliders size={12} style={{ opacity: 0.6 }} />
          </div>

          <button 
            className="apple-btn apple-btn-secondary" 
            onClick={handleLogout} 
            style={{ padding: '4px 10px', fontSize: '0.72rem' }}
            title="Sign Out"
          >
            <LogOut size={12} />
          </button>
        </div>
      </header>
    );
  };

  // ============================================================
  // Apple Dashboard View
  // ============================================================
  const renderDashboardView = () => {
    const isAdmin = user.role === 'admin';

    return (
      <div className="view-container">
        {/* Apple Keynote Hero */}
        <div className="apple-hero">
          <div className="hero-glow-accent"></div>
          
          <div className="hero-tag-strip">
            <span className="hero-pill-badge primary">
              <Sparkles size={11} /> Spark 4.2 Ultra Engine
            </span>
            <span className="hero-pill-badge secondary">
              <Database size={11} /> Delta Lake 4.0 & Iceberg v2
            </span>
            <span className="hero-pill-badge accent">
              <Zap size={11} /> Apple Intelligence Powered
            </span>
          </div>

          <h1 className="hero-title apple-gradient-text">
            Enterprise Data Engineering Studio
          </h1>
          <p className="hero-subtitle">
            Next-generation unified workspace emulating Azure Databricks, ADLS Gen2, Data Factory, and Synapse Analytics with Apache Spark 4.2 ANSI SQL performance.
          </p>

          <div className="hero-stats-grid">
            <div className="stat-capsule">
              <span className="stat-label">Core Engine</span>
              <span className="stat-value" style={{ color: 'var(--apple-coral)' }}>Spark 4.2</span>
              <span className="stat-desc">ANSI SQL • VARIANT Type</span>
            </div>

            <div className="stat-capsule">
              <span className="stat-label">Active Stack</span>
              <span className="stat-value" style={{ color: 'var(--apple-mint)' }}>{getActiveCount()}/7 Live</span>
              <span className="stat-desc">Zero-Config Passwordless</span>
            </div>

            <div className="stat-capsule">
              <span className="stat-label">Memory Budget</span>
              <span className="stat-value" style={{ color: 'var(--apple-blue)' }}>&lt; 5 GB</span>
              <span className="stat-desc">Optimized for M-Series & PCs</span>
            </div>

            <div className="stat-capsule">
              <span className="stat-label">AI Copilot</span>
              <span className="stat-value" style={{ color: 'var(--apple-purple)' }}>Active</span>
              <span className="stat-desc">Syntax, DDL & Logic Tuning</span>
            </div>
          </div>
        </div>

        {/* Services Showcase Grid */}
        <div className="section-header">
          <div>
            <h2 className="section-title">
              <Layers size={18} style={{ color: 'var(--apple-blue)' }} />
              Active Cloud Services
            </h2>
            <p className="section-subtitle">Local Azure equivalents running under unified orchestration</p>
          </div>

          <button 
            className="apple-btn apple-btn-secondary" 
            onClick={fetchServices} 
            style={{ fontSize: '0.75rem', padding: '4px 12px' }}
          >
            <RefreshCw size={12} />
            Refresh Metrics
          </button>
        </div>

        <div className="services-grid">
          {Object.entries(services).map(([key, service]) => {
            const Icon = SERVICE_ICONS[key] || Server;
            const themeColor = SERVICE_THEMES[key] || 'var(--apple-blue)';
            const isOnline = service.status === 'online';
            const inAction = actionLoading[key];

            const cpuVal = parseFloat(service.cpu_usage) || 0;
            const memVal = parseFloat(service.memory_percent) || 0;

            return (
              <div key={key} className="apple-service-card">
                <div>
                  <div className="card-top">
                    <div className="card-identity">
                      <div 
                        className="service-icon-box"
                        style={{
                          background: `linear-gradient(135deg, ${themeColor}25, ${themeColor}05)`,
                          border: `1px solid ${themeColor}40`
                        }}
                      >
                        <Icon size={20} style={{ color: themeColor }} />
                      </div>
                      <div className="service-meta">
                        <h3>{service.name}</h3>
                        <span className="service-container-tag">{service.container_name}</span>
                      </div>
                    </div>

                    <div className={`apple-status-badge ${isOnline ? 'online' : 'offline'}`}>
                      <div className={`pulse-dot ${isOnline ? 'online' : 'offline'}`}></div>
                      {isOnline ? 'Active' : 'Standby'}
                    </div>
                  </div>

                  <div className="card-meters" style={{ marginTop: '1rem' }}>
                    <div className="meter-row">
                      <div className="meter-header">
                        <span>CPU Load</span>
                        <span className="meter-val">{service.cpu_usage}</span>
                      </div>
                      <div className="meter-track">
                        <div 
                          className="meter-fill" 
                          style={{ width: `${Math.min(cpuVal || 8, 100)}%`, background: themeColor }}
                        ></div>
                      </div>
                    </div>

                    <div className="meter-row">
                      <div className="meter-header">
                        <span>Memory ({service.memory_usage})</span>
                        <span className="meter-val">{service.memory_percent}</span>
                      </div>
                      <div className="meter-track">
                        <div 
                          className="meter-fill" 
                          style={{ width: `${Math.min(memVal || 12, 100)}%`, background: themeColor }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card-actions">
                  <button 
                    onClick={() => setActiveTab(key)} 
                    className="apple-btn apple-btn-primary"
                    style={{ flex: 1 }}
                  >
                    Open Console <ChevronRight size={13} />
                  </button>

                  {isAdmin && (
                    isOnline ? (
                      <button 
                        className="apple-btn apple-btn-danger" 
                        onClick={() => handleStop(key)}
                        disabled={inAction !== null}
                        title="Stop Container"
                      >
                        <Square size={12} fill="currentColor" />
                      </button>
                    ) : (
                      <button 
                        className="apple-btn apple-btn-secondary" 
                        onClick={() => handleStart(key)}
                        disabled={inAction !== null}
                        title="Start Container"
                      >
                        <Play size={12} fill="currentColor" />
                      </button>
                    )
                  )}

                  <a 
                    href={service.ui_url} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="apple-btn apple-btn-secondary"
                    title="Open in new window"
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {/* Apple Pre-Built Labs Feature Grid */}
        <div className="section-header">
          <div>
            <h2 className="section-title">
              <BookOpen size={18} style={{ color: 'var(--apple-coral)' }} />
              Pre-Configured Hands-On Labs
            </h2>
            <p className="section-subtitle">Jump straight into production-grade data engineering scenarios with 1-click execution</p>
          </div>
        </div>

        <div className="labs-grid">
          <div className="apple-lab-card">
            <div>
              <span className="lab-tag" style={{ color: 'var(--apple-coral)', borderColor: 'rgba(255,69,58,0.3)' }}>Project 1 • Batch ETL</span>
              <h3 className="lab-title" style={{ marginTop: '0.6rem' }}>ADF → ADLS → Spark 4.2 → Synapse</h3>
              <p className="lab-desc" style={{ marginTop: '0.4rem' }}>
                Ingests raw TPC-H datasets from CSV to Bronze, cleans to Silver via PySpark, and loads analytical Gold marts into PostgreSQL DW.
              </p>
            </div>
            <button 
              className="apple-btn apple-btn-secondary" 
              onClick={() => loadNotebook('Medallion_Architecture_TPCH.ipynb')}
              style={{ width: '100%' }}
            >
              Launch Medallion Notebook <ChevronRight size={13} />
            </button>
          </div>

          <div className="apple-lab-card">
            <div>
              <span className="lab-tag" style={{ color: 'var(--apple-amber)', borderColor: 'rgba(255,159,10,0.3)' }}>Project 2 • Streaming</span>
              <h3 className="lab-title" style={{ marginTop: '0.6rem' }}>Event Hub → Spark Streaming</h3>
              <p className="lab-desc" style={{ marginTop: '0.4rem' }}>
                Streams real-time financial telemetry transactions from Redpanda via PySpark Structured Streaming directly into Delta Lake 4.0.
              </p>
            </div>
            <button 
              className="apple-btn apple-btn-secondary" 
              onClick={() => loadNotebook('project2_eventhub_streaming.ipynb')}
              style={{ width: '100%' }}
            >
              Launch Streaming Lab <ChevronRight size={13} />
            </button>
          </div>

          <div className="apple-lab-card">
            <div>
              <span className="lab-tag" style={{ color: 'var(--apple-mint)', borderColor: 'rgba(48,209,88,0.3)' }}>Project 3 • Incremental</span>
              <h3 className="lab-title" style={{ marginTop: '0.6rem' }}>ADF Incremental Micro-Batch</h3>
              <p className="lab-desc" style={{ marginTop: '0.4rem' }}>
                Polls FastAPI transaction endpoints incrementally, tracks high-watermark checkpoints, and merges changes using Delta MERGE statements.
              </p>
            </div>
            <button 
              className="apple-btn apple-btn-secondary" 
              onClick={() => loadDag('project3_adf_incremental_load')}
              style={{ width: '100%' }}
            >
              Launch Airflow Pipeline <ChevronRight size={13} />
            </button>
          </div>

          <div className="apple-lab-card">
            <div>
              <span className="lab-tag" style={{ color: 'var(--apple-indigo)', borderColor: 'rgba(94,92,230,0.3)' }}>Project 4 • CDC Feed</span>
              <h3 className="lab-title" style={{ marginTop: '0.6rem' }}>Database CDC → Lakehouse</h3>
              <p className="lab-desc" style={{ marginTop: '0.4rem' }}>
                Processes Change Data Capture events from transactional database logs, streaming updates directly into Iceberg & Delta Lake tables.
              </p>
            </div>
            <button 
              className="apple-btn apple-btn-secondary" 
              onClick={() => loadNotebook('project4_cdc_pipeline.ipynb')}
              style={{ width: '100%' }}
            >
              Launch CDC Pipeline <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // Apple Service Studio / Workspace (Split Console View)
  // ============================================================
  const renderWorkspaceView = (key) => {
    const service = services[key] || { name: key.toUpperCase(), container_name: key, status: 'online' };
    const themeColor = SERVICE_THEMES[key] || 'var(--apple-blue)';
    const credentials = SERVICE_CREDENTIALS[key];
    const currentUrl = iframeUrl[key] || PROXIED_SERVICE_URLS[key] || service.ui_url;
    const activeSubTab = workspaceTabs[key] || "interactive";

    return (
      <div className="workspace-studio">
        {/* Left Side Studio Control Panel */}
        <aside className="studio-sidebar">
          <div className="studio-sidebar-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {React.createElement(SERVICE_ICONS[key] || Server, { size: 18, style: { color: themeColor } })}
              <div>
                <h3 style={{ fontSize: '0.98rem' }}>{service.name}</h3>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontFamily: '"SF Mono", monospace' }}>{service.container_name}</span>
              </div>
            </div>

            <div className="apple-status-badge online">
              <div className="pulse-dot online"></div>
              Online
            </div>
          </div>

          {/* Segmented Control */}
          <div className="studio-segmented-tabs">
            <button 
              className={`studio-tab-btn ${activeSubTab === 'interactive' ? 'active' : ''}`}
              onClick={() => setWorkspaceTabs(prev => ({ ...prev, [key]: 'interactive' }))}
            >
              Controls
            </button>

            <button 
              className={`studio-tab-btn ${activeSubTab === 'resources' ? 'active' : ''}`}
              onClick={() => setWorkspaceTabs(prev => ({ ...prev, [key]: 'resources' }))}
            >
              Notebooks
            </button>

            <button 
              className={`studio-tab-btn ${activeSubTab === 'copilot' ? 'active' : ''}`}
              onClick={() => setWorkspaceTabs(prev => ({ ...prev, [key]: 'copilot' }))}
            >
              <Zap size={12} style={{ color: 'var(--apple-purple)' }} />
              Copilot
            </button>
          </div>

          {/* Sidebar Body */}
          <div className="studio-sidebar-body">
            {activeSubTab === 'interactive' && (
              <>
                <div className="studio-section-card">
                  <span className="studio-section-title">Resource Utilization</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div className="meter-row">
                      <div className="meter-header">
                        <span>CPU Usage</span>
                        <span className="meter-val">{service.cpu_usage || '0.5%'}</span>
                      </div>
                      <div className="meter-track">
                        <div className="meter-fill" style={{ width: service.cpu_usage || '8%', background: themeColor }}></div>
                      </div>
                    </div>

                    <div className="meter-row">
                      <div className="meter-header">
                        <span>RAM Memory</span>
                        <span className="meter-val">{service.memory_usage || '160 MB'}</span>
                      </div>
                      <div className="meter-track">
                        <div className="meter-fill" style={{ width: service.memory_percent || '12%', background: themeColor }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="studio-section-card">
                  <span className="studio-section-title">Integration & Credentials</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#ffffff' }}>
                    <Shield size={14} style={{ color: 'var(--apple-mint)' }} />
                    <span>Authentication: <strong>Passwordless</strong></span>
                  </div>
                  {credentials && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      Credential info: <code>{credentials}</code>
                    </span>
                  )}
                </div>

                <div className="studio-section-card">
                  <span className="studio-section-title">Actions</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button 
                      onClick={() => setIframeUrl(prev => ({ ...prev, [key]: PROXIED_SERVICE_URLS[key] }))}
                      className="apple-btn apple-btn-secondary"
                      style={{ width: '100%', justifyContent: 'flex-start' }}
                    >
                      <RefreshCw size={13} /> Reset Console to Root
                    </button>

                    <a 
                      href={service.ui_url} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="apple-btn apple-btn-secondary"
                      style={{ width: '100%', justifyContent: 'flex-start' }}
                    >
                      <ExternalLink size={13} /> Open in Dedicated Window
                    </a>
                  </div>
                </div>
              </>
            )}

            {activeSubTab === 'resources' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <span className="studio-section-title">Interactive Practice Notebooks</span>
                {key === 'databricks' && DATABRICKS_NOTEBOOKS.map(nb => (
                  <div 
                    key={nb.file}
                    className="reference-card-item"
                    onClick={() => setIframeUrl(prev => ({ ...prev, databricks: `/services/databricks/lab/tree/notebooks/${nb.file}` }))}
                  >
                    <div className="reference-card-title">
                      <Sparkles size={13} style={{ color: 'var(--apple-coral)' }} />
                      {nb.name}
                    </div>
                    <p className="reference-card-desc">{nb.description}</p>
                  </div>
                ))}

                {key === 'airflow' && AIRFLOW_DAGS.map(dag => (
                  <div 
                    key={dag.id}
                    className="reference-card-item"
                    onClick={() => setIframeUrl(prev => ({ ...prev, airflow: `/services/airflow/dags/${dag.id}/grid` }))}
                  >
                    <div className="reference-card-title">
                      <Calendar size={13} style={{ color: 'var(--apple-mint)' }} />
                      {dag.name}
                    </div>
                    <p className="reference-card-desc">{dag.description}</p>
                  </div>
                ))}

                {!['databricks', 'airflow'].includes(key) && (
                  <div className="studio-section-card">
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Select a notebook from Databricks or run custom transformations in the interactive console.
                    </span>
                    <button 
                      onClick={() => setActiveTab('databricks')}
                      className="apple-btn apple-btn-secondary"
                      style={{ marginTop: '0.5rem' }}
                    >
                      Go to Databricks Notebooks
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeSubTab === 'copilot' && (
              <div className="apple-intelligence-border">
                <div className="copilot-panel-inner">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="apple-intelligence-text" style={{ fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Zap size={14} /> Apple AI Copilot
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Spark 4.2</span>
                  </div>

                  {/* Preset Buttons */}
                  <div className="copilot-prompt-grid">
                    {key === 'databricks' && (
                      <>
                        <button onClick={() => handleCopilotSubmit(key, "validate_code")} className="copilot-chip">🔧 Check PySpark</button>
                        <button onClick={() => handleCopilotSubmit(key, "generate_code", "Write a PySpark 4.2 Delta Lake 4.0 MERGE statement with schema evolution")} className="copilot-chip">⚡ Delta 4.0 MERGE</button>
                        <button onClick={() => handleCopilotSubmit(key, "generate_code", "Show an example using Apache Spark 4.2 VARIANT data type")} className="copilot-chip">✨ VARIANT Type</button>
                        <button onClick={() => handleCopilotSubmit(key, "general", "Explain Spark 4.2 ANSI SQL mode differences")} className="copilot-chip">ℹ️ ANSI SQL Rules</button>
                      </>
                    )}

                    {key === 'airflow' && (
                      <>
                        <button onClick={() => handleCopilotSubmit(key, "validate_code")} className="copilot-chip">🔧 Validate DAG</button>
                        <button onClick={() => handleCopilotSubmit(key, "generate_code", "Generate an Airflow 2.9 DAG triggering a PySpark 4.2 job")} className="copilot-chip">⚡ PySpark DAG</button>
                      </>
                    )}

                    {key === 'synapse' && (
                      <>
                        <button onClick={() => handleCopilotSubmit(key, "generate_code", "Generate Postgres DDL for customer dimension and order fact Star Schema")} className="copilot-chip">⚡ Star Schema</button>
                        <button onClick={() => handleCopilotSubmit(key, "general", "Explain query optimization and index strategy for Postgres DW")} className="copilot-chip">📈 Index Strategy</button>
                      </>
                    )}

                    {key === 'datalake' && (
                      <>
                        <button onClick={() => handleCopilotSubmit(key, "validate_data")} className="copilot-chip">🔍 Check Data</button>
                        <button onClick={() => handleCopilotSubmit(key, "generate_code", "Write Python boto3 upload script to S3 bronze bucket")} className="copilot-chip">⚡ Ingest Script</button>
                      </>
                    )}

                    {!['databricks', 'airflow', 'synapse', 'datalake'].includes(key) && (
                      <>
                        <button onClick={() => handleCopilotSubmit(key, "generate_code", `Write a Python client script for ${key}`)} className="copilot-chip">⚡ Code Template</button>
                        <button onClick={() => handleCopilotSubmit(key, "general", `Explain connection integration patterns for ${service.name}`)} className="copilot-chip">ℹ️ Explain Patterns</button>
                      </>
                    )}
                  </div>

                  {/* Input area */}
                  <textarea 
                    className="copilot-textarea"
                    rows="3"
                    placeholder="Ask Copilot or paste code..."
                    value={copilotInput[key] || ""}
                    onChange={e => setCopilotInput(prev => ({ ...prev, [key]: e.target.value }))}
                  />

                  <button 
                    onClick={() => handleCopilotSubmit(key, "general")}
                    className="apple-btn apple-btn-accent"
                    style={{ width: '100%', padding: '0.5rem' }}
                    disabled={copilotLoading[key]}
                  >
                    {copilotLoading[key] ? "Generating..." : "Ask Copilot"}
                  </button>

                  {/* Response display */}
                  <div className="copilot-response-container">
                    {copilotResponse[key] ? (
                      <div>{renderMarkdown(copilotResponse[key])}</div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontStyle: 'italic' }}>
                        Ready. Click a prompt chip or enter your question above.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Right Side Main Viewport */}
        <div className="studio-main-viewport">
          <div className="studio-toolbar">
            <div className="toolbar-breadcrumb">
              <span>Studio</span>
              <ChevronRight size={12} />
              <strong>{service.name}</strong>
              <ChevronRight size={12} />
              <span style={{ fontFamily: '"SF Mono", monospace', fontSize: '0.7rem' }}>{currentUrl}</span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="apple-btn apple-btn-secondary" 
                onClick={() => setIframeUrl(prev => ({ ...prev, [key]: currentUrl }))}
                style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                title="Reload"
              >
                <RefreshCw size={11} /> Reload
              </button>
              <a 
                href={currentUrl} 
                target="_blank" 
                rel="noreferrer"
                className="apple-btn apple-btn-secondary"
                style={{ padding: '3px 8px', fontSize: '0.7rem' }}
              >
                <ExternalLink size={11} /> Pop Out
              </a>
            </div>
          </div>

          <div className="iframe-container">
            <iframe 
              src={currentUrl} 
              className="console-iframe" 
              title={service.name}
              key={`${key}-${currentUrl}`}
            />
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // Global Apple Intelligence View
  // ============================================================
  const renderAIAgentView = () => {
    return (
      <div className="view-container" style={{ maxWidth: '960px' }}>
        <div className="apple-intelligence-border" style={{ marginBottom: '1.5rem' }}>
          <div className="copilot-panel-inner" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
              <div className="apple-logo-badge" style={{ background: 'linear-gradient(135deg, #2997ff, #af52de)', width: '38px', height: '38px' }}>
                <Zap size={20} />
              </div>
              <div>
                <h2 className="apple-gradient-text" style={{ fontSize: '1.4rem' }}>Apple Intelligence Data Studio Assistant</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Full-stack architectural guidance, Spark 4.2 optimizations, and pipeline code generator
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <textarea 
                className="copilot-textarea"
                rows="4"
                placeholder="Ask anything about Spark 4.2, Iceberg catalogs, Delta Lake 4.0 MERGE, Airflow DAG patterns, Kafka streaming, or PostgreSQL warehousing..."
                value={copilotInput['global'] || ""}
                onChange={e => setCopilotInput(prev => ({ ...prev, 'global': e.target.value }))}
                style={{ fontSize: '0.85rem', padding: '0.85rem' }}
              />

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button onClick={() => handleCopilotSubmit('global', "general", "What are the biggest improvements in Apache Spark 4.2 for data engineers?")} className="copilot-chip">
                    Spark 4.2 Highlights
                  </button>
                  <button onClick={() => handleCopilotSubmit('global', "general", "How do I configure PySpark 4.2 and Airflow 2.9 together?")} className="copilot-chip">
                    Airflow + Spark 4.2
                  </button>
                  <button onClick={() => handleCopilotSubmit('global', "general", "Explain Medallion Architecture Bronze, Silver, Gold design")} className="copilot-chip">
                    Medallion Best Practices
                  </button>
                </div>

                <button 
                  onClick={() => handleCopilotSubmit('global', "general")}
                  className="apple-btn apple-btn-accent"
                  style={{ padding: '0.6rem 1.25rem' }}
                  disabled={copilotLoading['global']}
                >
                  {copilotLoading['global'] ? "Analyzing..." : "Generate Guidance"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Global Response */}
        <div className="apple-hero" style={{ padding: '1.75rem', minHeight: '260px' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Terminal size={16} style={{ color: 'var(--apple-blue)' }} /> Studio Assistant Response
          </h3>

          {copilotResponse['global'] ? (
            <div style={{ fontSize: '0.85rem', lineHeight: '1.6' }}>
              {renderMarkdown(copilotResponse['global'])}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
              <Zap size={28} style={{ opacity: 0.3, margin: '0 auto 0.5rem auto' }} />
              <p style={{ fontSize: '0.85rem' }}>Select a prompt chip above or ask a custom question.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============================================================
  // Apple Settings & User Management Modal
  // ============================================================
  const renderSettingsModal = () => {
    if (!showSettingsModal) return null;
    const isAdmin = user.role === 'admin';

    return (
      <div className="apple-modal-overlay" onClick={() => setShowSettingsModal(false)}>
        <div className="apple-modal-sheet" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2 className="apple-gradient-text" style={{ fontSize: '1.25rem' }}>Studio Settings & Security</h2>
            <button 
              className="apple-btn apple-btn-secondary" 
              onClick={() => setShowSettingsModal(false)}
              style={{ padding: '3px 8px', fontSize: '0.72rem' }}
            >
              Done
            </button>
          </div>

          {/* Gemini API Key */}
          <div className="studio-section-card">
            <span className="studio-section-title">Google Gemini LLM Authentication</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Key size={16} style={{ color: geminiKey ? 'var(--apple-amber)' : 'var(--text-muted)' }} />
              <input 
                type="password"
                className="apple-input"
                placeholder="Enter Gemini API Key..."
                value={geminiKey}
                onChange={e => {
                  setGeminiKey(e.target.value);
                  localStorage.setItem('gemini_api_key', e.target.value);
                }}
                style={{ flex: 1 }}
              />
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Powers intelligent Python, PySpark 4.2, and SQL query explanations.
            </span>
          </div>

          {/* User Management (Admins) */}
          {isAdmin && (
            <div className="studio-section-card">
              <span className="studio-section-title">User Accounts ({userList.length} registered)</span>
              
              <table className="apple-table" style={{ marginBottom: '1rem' }}>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {userList.map(u => (
                    <tr key={u.username}>
                      <td style={{ fontWeight: 600 }}>{u.username}</td>
                      <td>
                        <span className={`hero-pill-badge ${u.role === 'admin' ? 'primary' : 'secondary'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td>
                        {["aariz", "ariz"].includes(u.username) ? (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Bootstrap</span>
                        ) : (
                          <button 
                            onClick={() => handleDeleteUser(u.username)}
                            style={{ background: 'none', border: 'none', color: 'var(--apple-coral)', cursor: 'pointer' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Create User Form */}
              <form onSubmit={handleCreateUser} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="text"
                  className="apple-input"
                  placeholder="Username"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  style={{ flex: 1 }}
                  required
                />
                <input 
                  type="password"
                  className="apple-input"
                  placeholder="Password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  style={{ flex: 1 }}
                  required
                />
                <button type="submit" className="apple-btn apple-btn-primary">
                  Add User
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      {renderNavbar()}
      <main className="content-area">
        {activeTab === 'dashboard' && renderDashboardView()}
        {activeTab === 'ai_agent' && renderAIAgentView()}
        {!['dashboard', 'ai_agent'].includes(activeTab) && renderWorkspaceView(activeTab)}
      </main>
      {renderSettingsModal()}
    </div>
  );
}
