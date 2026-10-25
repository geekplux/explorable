import { Logo } from './Logo.tsx';

/** The spiral mark (wide crop) + "Explorable": 20px in the header, 14px in the footer. */
export function Wordmark({ size }: { size: 'header' | 'footer' }) {
  return (
    <span className={`wordmark wordmark-${size}`}>
      <Logo size={size === 'header' ? 24 : 18} wide />
      Explorable
    </span>
  );
}
