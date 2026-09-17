import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LoginPanel } from './LoginPanel';

describe('LoginPanel', () => {
  it('renders credential fields and a warning to replace the starter administrator password', () => {
    const html = renderToStaticMarkup(
      <LoginPanel onClose={() => undefined} onLogin={async () => null} />,
    );

    expect(html).toContain('Username');
    expect(html).toContain('Password');
    expect(html).toContain('admin123');
  });
});
