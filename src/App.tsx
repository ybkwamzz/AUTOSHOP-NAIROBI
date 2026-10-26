/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { DEFAULT_BUSINESS_CONFIG, BusinessConfig } from './config/businessConfig';
import { StaffRole } from './domain/leadLifecycle';
import { TopNav } from './components/TopNav';
import { CustomerWebsite } from './components/CustomerWebsite';
import { StaffPortal } from './components/StaffPortal';
import { HandoverDocsView } from './components/HandoverDocsView';

export default function App() {
  const [config, setConfig] = useState<BusinessConfig>(DEFAULT_BUSINESS_CONFIG);
  const [systemStatus, setSystemStatus] = useState<{
    persistenceEngine: string;
    postgresConfigured: boolean;
    automatedWebhookConfigured: boolean;
    geminiConfigured: boolean;
    serverTimeUtc: string;
    serverTimeNairobi: string;
  } | null>(null);

  const [activeView, setActiveView] = useState<'website' | 'staff' | 'handover'>(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    if (viewParam === 'staff') return 'staff';
    if (viewParam === 'handover') return 'handover';
    return 'website';
  });

  const [selectedServiceSlug, setSelectedServiceSlug] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('service');
  });

  const [staffSession, setStaffSession] = useState<{
    authenticated: boolean;
    token?: string;
    staffName?: string;
    role?: StaffRole;
  }>({ authenticated: false });

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.config) setConfig(data.config);
        if (data.systemStatus) setSystemStatus(data.systemStatus);
      })
      .catch(() => {
        // Fallback to default config if offline
      });

    fetch('/api/staff/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          setStaffSession({
            authenticated: true,
            staffName: data.staffName,
            role: data.role,
          });
        }
      })
      .catch(() => {
        // Ignore session check error
      });
  }, []);

  // Update document title dynamically for Local SEO based on active service or view
  useEffect(() => {
    if (activeView === 'staff') {
      document.title = `Staff Lead Ledger — ${config.brandShortName}`;
    } else if (activeView === 'handover') {
      document.title = `Secretary SOP & Owner Handover — ${config.brandShortName}`;
    } else if (selectedServiceSlug) {
      const svc = config.services.find((s) => s.slug === selectedServiceSlug);
      if (svc) {
        document.title = `${svc.title} in Lang'ata, Nairobi — ${config.brandShortName}`;
      }
    } else {
      document.title = `${config.brandShortName} — Vehicle Diagnostics, Servicing & Repairs in Lang'ata, Nairobi`;
    }
  }, [activeView, selectedServiceSlug, config]);

  const handleSelectServiceSlug = (slug: string | null) => {
    setSelectedServiceSlug(slug);
    const url = new URL(window.location.href);
    if (slug) {
      url.searchParams.set('service', slug);
    } else {
      url.searchParams.delete('service');
    }
    window.history.replaceState({}, '', url.toString());
  };

  const handleJumpToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/staff/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setStaffSession({ authenticated: false });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopNav
        config={config}
        activeView={activeView}
        onSelectView={setActiveView}
        onJumpToSection={handleJumpToSection}
        staffSession={staffSession}
      />

      {activeView === 'website' && (
        <CustomerWebsite
          config={config}
          initialServiceSlug={selectedServiceSlug}
          onSelectServiceSlug={handleSelectServiceSlug}
          onOpenStaffPortal={() => {
            setActiveView('staff');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onOpenHandoverDocs={() => {
            setActiveView('handover');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}

      {activeView === 'staff' && (
        <StaffPortal
          config={config}
          staffSession={staffSession}
          onLoginSuccess={(sess) => setStaffSession(sess)}
          onLogout={handleLogout}
          onConfigUpdated={(updated) => setConfig(updated)}
          onOpenHandoverDocs={() => {
            setActiveView('handover');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}

      {activeView === 'handover' && (
        <HandoverDocsView
          config={config}
          systemStatus={systemStatus}
          onNavigateToStaff={() => {
            setActiveView('staff');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateToWebsite={() => {
            setActiveView('website');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}
    </div>
  );
}
