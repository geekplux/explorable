import { describe, expect, it } from 'vitest';
import { ApiError } from './errors';
import { isBlockedHost, normaliseUrl } from './url';

const codeOf = (input: string) => {
  try {
    normaliseUrl(input);
    return 'ok';
  } catch (error) {
    return error instanceof ApiError ? error.code : 'thrown';
  }
};

describe('normaliseUrl', () => {
  it.each([
    'https://arxiv.org/abs/1706.03762v7',
    'http://arxiv.org/pdf/1706.03762.pdf',
    'arxiv.org/html/1706.03762v2#S3',
    'https://export.arxiv.org/abs/1706.03762',
    'arXiv:1706.03762v3',
  ])('maps %s to arxiv:1706.03762', (input) => {
    expect(normaliseUrl(input)).toEqual({
      kind: 'arxiv',
      id: '1706.03762',
      canonical: 'arxiv:1706.03762',
      url: 'https://arxiv.org/abs/1706.03762',
    });
  });

  it('accepts old-style arXiv ids', () => {
    expect(normaliseUrl('https://arxiv.org/abs/hep-th/9901001v2').canonical).toBe('arxiv:hep-th/9901001');
    expect(normaliseUrl('arxiv.org/pdf/math.GT/0309136').canonical).toBe('arxiv:math.GT/0309136');
  });

  it('lowercases the host, drops the hash and tracking params, keeps others', () => {
    const source = normaliseUrl('HTTPS://Example.COM/post?utm_source=x&id=3&UTM_Medium=y&fbclid=z#top');
    expect(source).toEqual({ kind: 'web', canonical: 'https://example.com/post?id=3', url: 'https://example.com/post?id=3' });
    expect(normaliseUrl('example.com/a?utm_campaign=q').url).toBe('https://example.com/a');
  });

  it.each([
    ['http://localhost', 'BLOCKED_URL'],
    ['http://LOCALHOST.', 'BLOCKED_URL'],
    ['http://127.0.0.1', 'BLOCKED_URL'],
    ['http://10.0.0.1', 'BLOCKED_URL'],
    ['http://172.20.1.1', 'BLOCKED_URL'],
    ['http://192.168.1.1', 'BLOCKED_URL'],
    ['http://[::1]', 'BLOCKED_URL'],
    ['http://[::ffff:7f00:1]', 'BLOCKED_URL'],
    ['http://169.254.169.254/latest/meta-data', 'BLOCKED_URL'],
    ['http://2130706433', 'BLOCKED_URL'],
    ['http://0x7f000001', 'BLOCKED_URL'],
    ['http://0177.0.0.1', 'BLOCKED_URL'],
    ['http://printer.local', 'BLOCKED_URL'],
    ['http://metadata.internal', 'BLOCKED_URL'],
    ['http://intranet', 'BLOCKED_URL'],
    ['file:///etc/passwd', 'BLOCKED_URL'],
    ['ftp://x', 'BLOCKED_URL'],
    ['https://example.com:8080', 'BLOCKED_URL'],
    ['https://user:pw@example.com/', 'BLOCKED_URL'],
    ['javascript:alert(1)', 'INVALID_URL'],
    ['', 'INVALID_URL'],
    ['not a url', 'INVALID_URL'],
  ])('rejects %s as %s', (input, code) => {
    expect(codeOf(input)).toBe(code);
  });

  it('allows public hosts and default ports', () => {
    expect(codeOf('https://example.com:443/x')).toBe('ok');
    expect(codeOf('http://93.184.215.14/')).toBe('ok');
    expect(isBlockedHost('blog.example.org')).toBe(false);
  });
});
