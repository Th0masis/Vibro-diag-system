/**
 * PageTitle Component
 * Unified page title component for consistent styling across all pages
 * Accepts string or JSX for title and subtitle
 */

export default function PageTitle({ 
  title,           // string or JSX element
  subtitle,        // optional string or JSX element
  children         // right-side content (buttons, stats, etc.)
}) {
  return (
    <div className="page-title-header">
      <div className="page-title-section">
        <h1 className="page-title">{title}</h1>
        {subtitle && <div className="page-title-subtitle">{subtitle}</div>}
      </div>
      {children && <div className="page-title-actions">{children}</div>}
    </div>
  );
}
