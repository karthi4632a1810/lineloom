/** Shared page chrome for legacy queue/admin screens inside ClinicalShell. */
export const ClinicalPageHeader = ({ title, subtitle = null, children = null }) => (
  <header className="cc-page-header page-header">
    <div>
      <h1 className="cc-page-title">{title}</h1>
      {subtitle ? <p className="cc-page-lead page-subtitle">{subtitle}</p> : null}
    </div>
    {children ? <div className="cc-page-actions">{children}</div> : null}
  </header>
);
