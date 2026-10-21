// Vite/Vitest `?raw` imports (fixtures in tests).
declare module '*?raw' {
  const text: string;
  export default text;
}
