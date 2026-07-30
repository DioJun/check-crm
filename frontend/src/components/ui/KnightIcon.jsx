import logoCavalo from '../../assets/logo-cavalo.png';

export default function KnightIcon({ className = 'w-8 h-8' }) {
  return (
    <img
      src={logoCavalo}
      alt="Checkmate CRM"
      className={className}
      style={{ objectFit: 'contain', borderRadius: '8px' }}
    />
  );
}
