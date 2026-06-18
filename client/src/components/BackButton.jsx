import { useNavigate } from 'react-router-dom';

export default function BackButton({ to, label = 'Back' }) {
  const navigate = useNavigate();

  const handleClick = (e) => {
    if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  };

  return (
    <button className="back-button" onClick={handleClick}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      <span>{label}</span>
    </button>
  );
}