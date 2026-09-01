import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../contexts/TransitContext', () => ({
  useTransit: () => ({
    terminals: [{
      id: 'terminal-general-luna',
      name: 'General Luna Terminal',
      details: 'Tourism Road, General Luna',
      latitude: 9.7895,
      longitude: 126.1554,
    }],
  }),
}));

import { TerminalScreen } from './TerminalScreen';

describe('TerminalScreen', () => {
  it('renders each shared terminal with a View map action for passenger map selection', () => {
    const html = renderToStaticMarkup(
      <TerminalScreen onBack={() => undefined} onViewMap={() => undefined} />,
    );

    expect(html).toContain('General Luna Terminal');
    expect(html).toContain('Tourism Road, General Luna');
    expect(html).toContain('View map');
  });
});
