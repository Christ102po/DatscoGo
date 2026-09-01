import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SplashScreen } from './SplashScreen';

describe('SplashScreen', () => {
  it('renders DatscoGo transit branding and the loading layer', () => {
    const markup = renderToStaticMarkup(<SplashScreen isExiting={false} />);

    expect(markup).toContain('Loading DatscoGo');
    expect(markup).toContain('Datsco');
    expect(markup).toContain('Siargao Transit');
    expect(markup).toContain('aria-label="DatscoGo"');
    expect(markup).not.toContain('datsco-splash--exiting');
  });

  it('adds the exit class while the splash is fading out', () => {
    const markup = renderToStaticMarkup(<SplashScreen isExiting />);

    expect(markup).toContain('datsco-splash--exiting');
  });
});
