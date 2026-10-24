import { useState } from 'react'
import { useI18n, type StringKey } from '../i18n'
import { LangToggle } from './bits'
import './shared-ui.css'

const PACKAGES: { name: string; licenses: number; text: string }[] = [
  { name: 'flutter', licenses: 34, text: 'Copyright 2014 The Flutter Authors. All rights reserved.\n\nRedistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met: ...' },
  { name: 'supabase_flutter', licenses: 1, text: 'MIT License\n\nCopyright (c) 2020 Supabase\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software ...' },
  { name: 'flutter_bloc', licenses: 1, text: 'MIT License\n\nCopyright (c) 2018 Felix Angelov ...' },
  { name: 'drag_and_drop_lists', licenses: 1, text: 'BSD 3-Clause License\n\nCopyright (c) 2020, Philip Brink ...' },
  { name: 'speech_to_text', licenses: 1, text: 'BSD 3-Clause License\n\nCopyright (c) 2019, Corner Software Development Corp. ...' },
  { name: 'intl', licenses: 1, text: 'Copyright 2013, the Dart project authors. ...' },
  { name: 'go_router', licenses: 1, text: 'Copyright 2013 The Flutter Authors. All rights reserved. ...' },
  { name: 'shared_preferences', licenses: 1, text: 'Copyright 2013 The Flutter Authors. All rights reserved. ...' },
  { name: 'url_launcher', licenses: 1, text: 'Copyright 2013 The Flutter Authors. All rights reserved. ...' },
  { name: 'vector_math', licenses: 2, text: 'Copyright 2015, Google Inc. All rights reserved. ...' },
]

type Page = 'root' | 'licenses' | { pkg: string }

function Row({ icon, label, value, onClick, testId, danger }: { icon: string; label: string; value?: string; onClick?: () => void; testId?: string; danger?: boolean }) {
  return (
    <button className={`ms-row ${danger ? 'danger' : ''}`} onClick={onClick} data-testid={testId}>
      <span className="ms-icon" aria-hidden>
        {icon}
      </span>
      <span className="ms-label">{label}</span>
      {value && <span className="ms-value">{value}</span>}
      {onClick && !danger && <span className="ms-chev" aria-hidden>›</span>}
    </button>
  )
}

/**
 * The "More" tab, shared by every direction: settings, logout, legal and a Flutter-style LicensePage mock.
 * Navigation inside it is a local stack, no router.
 */
export function MoreScreen({ onLogout }: { onLogout: () => void }) {
  const { t } = useI18n()
  const [page, setPage] = useState<Page>('root')

  if (page === 'licenses' || typeof page === 'object') {
    const pkg = typeof page === 'object' ? PACKAGES.find((p) => p.name === page.pkg) : undefined
    return (
      <div className="ms-root" data-testid="licenses-page">
        <header className="ms-appbar">
          <button className="ms-back" onClick={() => setPage(pkg ? 'licenses' : 'root')} aria-label={t('back')}>
            ←
          </button>
          <h1>{pkg ? pkg.name : t('licenses')}</h1>
        </header>
        {pkg ? (
          <pre className="ms-license">{pkg.text}</pre>
        ) : (
          <>
            <div className="ms-about">
              <div className="ms-applogo" aria-hidden>
                🛒
              </div>
              <strong>{t('appName')}</strong>
              <span>1.0.0 (42)</span>
              <span className="ms-powered">Powered by Flutter</span>
            </div>
            {PACKAGES.map((p) => (
              <button key={p.name} className="ms-pkg" onClick={() => setPage({ pkg: p.name })}>
                <span>{p.name}</span>
                <small>
                  {p.licenses} {p.licenses === 1 ? 'license' : 'licenses'}
                </small>
              </button>
            ))}
          </>
        )}
      </div>
    )
  }

  const section = (key: StringKey) => <h2 className="ms-section">{t(key)}</h2>
  return (
    <div className="ms-root" data-testid="more-screen">
      <header className="ms-appbar">
        <h1>{t('tabMore')}</h1>
        <LangToggle />
      </header>
      <div className="ms-profile">
        <span className="ms-avatar">P</span>
        <div>
          <strong>Peter</strong>
          <small>peter@example.com · {t('household')}: Peter & Sam</small>
        </div>
      </div>
      {section('settings')}
      <Row icon="🏠" label={t('household')} value="Peter & Sam" onClick={() => {}} />
      <Row icon="🏬" label={t('storesAndCategories')} value="5 · 11" onClick={() => {}} />
      <Row icon="🌐" label={t('language')} value="Deutsch / English" />
      <Row icon="🔔" label={t('notifications')} value={t('on')} onClick={() => {}} />
      <Row icon="🎙️" label={t('integrations')} onClick={() => {}} />
      {section('legal')}
      <Row icon="📄" label={t('imprint')} onClick={() => {}} />
      <Row icon="🔒" label={t('privacy')} onClick={() => {}} />
      <Row icon="⚖️" label={t('licenses')} onClick={() => setPage('licenses')} testId="licenses-link" />
      {section('account')}
      <Row icon="↩︎" label={t('logout')} onClick={onLogout} testId="logout" danger />
      <p className="ms-version">
        {t('version')} 1.0.0 (42)
      </p>
    </div>
  )
}
