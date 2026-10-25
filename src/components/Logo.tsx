import { useId } from 'react';
import { SPIRAL_END, SPIRAL_LARGE, SPIRAL_SMALL } from './logo-paths.ts';

const [EX, EY] = SPIRAL_END;
const CONSTRUCTION = 'M6 16H58V48H6ZM38 16V48M38 36H58M46 36V48M38 40H46M42 36V40';
const COMPASS = [[38, 48], [38, 36], [46, 36], [46, 40]] as const;

/**
 * The spiral mark (docs/redesign/DESIGN.md §3). At 28px and up it is drawn over its construction squares with a halo;
 * smaller, the stroke thickens and the construction drops out. `wide` is the lockup crop (viewBox 3 10 58 41).
 * Gradient ids come from useId, so several marks can share a page. The logo keeps its own colours (exempt from the tokens).
 */
export function Logo({ size, wide = false }: { size: number; wide?: boolean }) {
  const id = useId().replace(/[^\w-]/g, '');
  const small = size < 28;
  return (
    <svg className="logo" width={wide ? Math.round((size * 58) / 41) : size} height={size} viewBox={wide ? '3 10 58 41' : '0 0 64 64'} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${id}s`} cx={EX} cy={EY} r="40" gradientUnits="userSpaceOnUse">
          <stop offset=".05" stopColor="#ff8b3e" />
          <stop offset=".3" stopColor="#e54666" />
          <stop offset=".55" stopColor="#8e4ec6" />
          <stop offset=".95" stopColor="#3e63dd" />
        </radialGradient>
        {!small && (
          <radialGradient id={`${id}h`} cx={EX} cy={EY} r="7" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffc53d" stopOpacity=".55" />
            <stop offset="1" stopColor="#ffc53d" stopOpacity="0" />
          </radialGradient>
        )}
      </defs>
      {!small && (
        <g fill="var(--logo-faint)">
          <path d={CONSTRUCTION} fill="none" stroke="var(--logo-faint)" strokeWidth=".5" />
          {COMPASS.map(([cx, cy]) => (
            <circle key={`${cx},${cy}`} cx={cx} cy={cy} r=".9" />
          ))}
        </g>
      )}
      <path d={small ? SPIRAL_SMALL : SPIRAL_LARGE} fill={`url(#${id}s)`} />
      {!small && <circle cx={EX} cy={EY} r="7" fill={`url(#${id}h)`} />}
      <circle cx={EX} cy={EY} r={small ? 3.4 : 2.6} fill="#ffc53d" />
    </svg>
  );
}
