import Card from '../../components/ui/Card.jsx'

export default function HistoryCard({ tone = 'neutral', density = 'regular', className = '', ...props }) {
  return <Card
    {...props}
    hover={false}
    className={`history-card ${tone === 'accent' ? 'history-card-accent' : ''} ${density === 'compact' ? 'history-card-compact' : ''} ${className}`}
  />
}
