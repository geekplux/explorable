/**
 * Entry of the prebuilt skill bundle (`pnpm build:kit` → `kit/dist/explorable-kit.{js,css}`):
 * the whole public API plus the tokens and kit styles, with no framework.
 */
import './styles/tokens.css';
import './styles/kit.css';

export * from './index.ts';
