interface StatCardProps {
  label: string;
  value: string | number;
  color?: string;
  subtitle?: string;
  unit?: string;
}

const StatCard = ({ label, value, color, subtitle, unit }: StatCardProps) => (
  <div className="stat-card">
    <div className="stat-card-label">{label}</div>
    <div className="stat-card-value" style={color ? { color } : undefined}>
      {value}
      {unit && <span className="stat-card-unit">{unit}</span>}
    </div>
    {subtitle && <div className="stat-card-subtitle">{subtitle}</div>}
  </div>
);

export default StatCard;
