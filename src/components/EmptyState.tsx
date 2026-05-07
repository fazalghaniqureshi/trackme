interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
}

const EmptyState = ({ icon, title, message, action }: EmptyStateProps) => (
  <div className="empty-state">
    {icon && <div className="empty-state-icon">{icon}</div>}
    <div className="empty-state-title">{title}</div>
    <div className="empty-state-message">{message}</div>
    {action && (
      <button className="btn btn-sm btn-outline-primary mt-3" onClick={action.onClick}>
        {action.label}
      </button>
    )}
  </div>
);

export default EmptyState;
