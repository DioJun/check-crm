export default function KnightIcon({ className = 'w-8 h-8' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className={className} fill="none">
      <defs>
        <linearGradient id="knight-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="10" fill="url(#knight-g)" />
      <path
        d="M33.5 36H15.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5h18c.8 0 1.5.7 1.5 1.5s-.7 1.5-1.5 1.5z"
        fill="#e0e7ff"
      />
      <path
        d="M30.8 31H17c-.3 0-.5-.1-.7-.3l-2-2.5c-.4-.5-.2-1.3.2-1.7l3.5-3c.5-.4.5-1 .3-1.5L16 18.2c-.5-.8-.3-1.8.4-2.4l2.5-2c.3-.2.4-.6.3-1L18 9.2c-.2-.8.3-1.6 1.1-1.8.1 0 .3-.1.4-.1h2.8c.7 0 1.3.4 1.6 1l1.4 2.8c.2.4.6.7 1 .8l3.5.7c.8.2 1.4.9 1.4 1.7v1c0 .5.3 1 .7 1.2l2.3 1.2c.7.4 1 1.2.8 2l-.8 2.5c-.2.5 0 1.1.4 1.4l2.2 1.6c.7.5.8 1.4.4 2.1l-1.5 2.3c-.4.6-1 1-1.7 1.1L30.8 31z"
        fill="white"
      />
      <circle cx="23.5" cy="13.5" r="1.5" fill="#4f46e5" />
    </svg>
  );
}
