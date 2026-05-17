import { memo, useMemo } from 'react';

interface CodePanelProps {
  content: string | null;
  emptyMessage: string;
  label: string;
}

export const CodePanel = memo(function CodePanel({
  content,
  emptyMessage,
  label,
}: CodePanelProps) {
  const lineCount = useMemo(
    () => (content ? content.split('\n').length : 0),
    [content],
  );

  return (
    <section className="code-panel" aria-label={label}>
      <div className="code-panel-toolbar">
        <span className="code-panel-label">{label}</span>
        {content ? (
          <span className="code-panel-meta">{lineCount.toLocaleString()} lines</span>
        ) : null}
      </div>
      {content ? (
        <pre className="code-panel-pre">{content}</pre>
      ) : (
        <p className="code-panel-empty">{emptyMessage}</p>
      )}
    </section>
  );
});
