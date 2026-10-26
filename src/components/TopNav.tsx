import React from 'react';
import { BusinessConfig } from '../config/businessConfig';
import { StaffRole } from '../domain/leadLifecycle';

interface TopNavProps {
  config: BusinessConfig;
  activeView: 'website' | 'staff' | 'handover';
  onSelectView: (view: 'website' | 'staff' | 'handover') => void;
  onJumpToSection: (sectionId: string) => void;
  staffSession: { authenticated: boolean; staffName?: string; role?: StaffRole };
}

export const TopNav: React.FC<TopNavProps> = ({
  config,
  activeView,
  onSelectView,
  onJumpToSection,
  staffSession,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-950 text-white border-b border-slate-800">
      <div className="max-w-[1280px] mx-auto flex items-center justify-between gap-8 px-4 sm:px-6 py-3.5">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onSelectView('website');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="text-lg font-bold tracking-tight text-white hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          {config.brandShortName}
        </a>

        {/* Zone 2: 4-5 concise single-line text navigation links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300"
        >
          <a
            href="#services"
            onClick={(e) => {
              e.preventDefault();
              onSelectView('website');
              setTimeout(() => onJumpToSection('services'), 20);
            }}
            className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              activeView === 'website' ? 'text-white' : ''
            }`}
          >
            Services
          </a>
          <a
            href="#coverage"
            onClick={(e) => {
              e.preventDefault();
              onSelectView('website');
              setTimeout(() => onJumpToSection('coverage'), 20);
            }}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Coverage &amp; Hours
          </a>
          <a
            href="#faq"
            onClick={(e) => {
              e.preventDefault();
              onSelectView('website');
              setTimeout(() => onJumpToSection('faq'), 20);
            }}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            FAQ
          </a>
          <a
            href="#staff-portal"
            onClick={(e) => {
              e.preventDefault();
              onSelectView('staff');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              activeView === 'staff' ? 'text-amber-400 underline' : ''
            }`}
          >
            {staffSession.authenticated ? `Staff Ledger (${staffSession.role})` : 'Staff Ledger'}
          </a>
          <a
            href="#handover-kit"
            onClick={(e) => {
              e.preventDefault();
              onSelectView('handover');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              activeView === 'handover' ? 'text-amber-400 underline' : ''
            }`}
          >
            SOP &amp; Handover
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              onSelectView('website');
              setTimeout(() => onJumpToSection('enquiry-form'), 20);
            }}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-white"
          >
            Request Service
          </button>
        </div>
      </div>

      {/* Mobile Navigation Strip (visible only below md breakpoint) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden flex items-center gap-5 overflow-x-auto px-4 py-2 bg-slate-900 border-t border-slate-800 text-xs font-medium text-slate-300"
      >
        <a
          href="#services"
          onClick={(e) => {
            e.preventDefault();
            onSelectView('website');
            setTimeout(() => onJumpToSection('services'), 20);
          }}
          className="hover:text-white whitespace-nowrap shrink-0"
        >
          Services
        </a>
        <a
          href="#coverage"
          onClick={(e) => {
            e.preventDefault();
            onSelectView('website');
            setTimeout(() => onJumpToSection('coverage'), 20);
          }}
          className="hover:text-white whitespace-nowrap shrink-0"
        >
          Coverage &amp; Hours
        </a>
        <a
          href="#faq"
          onClick={(e) => {
            e.preventDefault();
            onSelectView('website');
            setTimeout(() => onJumpToSection('faq'), 20);
          }}
          className="hover:text-white whitespace-nowrap shrink-0"
        >
          FAQ
        </a>
        <a
          href="#staff-portal"
          onClick={(e) => {
            e.preventDefault();
            onSelectView('staff');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`hover:text-white whitespace-nowrap shrink-0 ${
            activeView === 'staff' ? 'text-amber-400 font-semibold' : ''
          }`}
        >
          {staffSession.authenticated ? `Staff (${staffSession.role})` : 'Staff Ledger'}
        </a>
        <a
          href="#handover-kit"
          onClick={(e) => {
            e.preventDefault();
            onSelectView('handover');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`hover:text-white whitespace-nowrap shrink-0 ${
            activeView === 'handover' ? 'text-amber-400 font-semibold' : ''
          }`}
        >
          SOP &amp; Handover
        </a>
      </nav>
    </header>
  );
};
