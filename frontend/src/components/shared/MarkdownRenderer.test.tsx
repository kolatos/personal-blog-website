import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MarkdownRenderer } from './MarkdownRenderer';

describe('MarkdownRenderer', () => {
  // ── LaTeX: inline math ────────────────────────────────────────────────────

  it('renders inline math $x^2$ as a KaTeX span', () => {
    const { container } = render(<MarkdownRenderer content="Nilai $x^2$ di sini" />);
    const katexEl = container.querySelector('.katex');
    expect(katexEl).not.toBeNull();
  });

  // ── LaTeX: display math ───────────────────────────────────────────────────

  it('renders display math $$...$$ with .katex-display class', () => {
    // remark-math v6: display (block) math uses $$ on separate lines
    const displayContent = 'Sebelum\n\n$$\n\\int_0^1 f\\,dx\n$$\n\nSesudah';
    const { container } = render(<MarkdownRenderer content={displayContent} />);
    // rehype-katex wraps display math in .katex-display
    const displayEl = container.querySelector('.katex-display');
    expect(displayEl).not.toBeNull();
  });

  // ── Standard Markdown elements ────────────────────────────────────────────

  it('renders headings correctly', () => {
    const { container } = render(
      <MarkdownRenderer content={'# Heading 1\n## Heading 2\n### Heading 3'} />
    );
    expect(container.querySelector('h1')).not.toBeNull();
    expect(container.querySelector('h2')).not.toBeNull();
    expect(container.querySelector('h3')).not.toBeNull();
  });

  it('renders a fenced code block as <pre><code>', () => {
    const { container } = render(
      <MarkdownRenderer content={'```js\nconsole.log("hi");\n```'} />
    );
    expect(container.querySelector('pre')).not.toBeNull();
    expect(container.querySelector('pre code')).not.toBeNull();
  });

  it('renders a link with correct href', () => {
    const { container } = render(
      <MarkdownRenderer content={'[Kiro](https://kiro.dev)'} />
    );
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('https://kiro.dev');
  });

  // ── Image rendering ───────────────────────────────────────────────────────

  it('renders an image tag from external URL', () => {
    const { container } = render(
      <MarkdownRenderer content={'![img](https://example.com/a.png)'} />
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('https://example.com/a.png');
  });

  // ── className prop ────────────────────────────────────────────────────────

  it('applies additional className to wrapper div', () => {
    const { container } = render(
      <MarkdownRenderer content="hello" className="custom-class" />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.classList.contains('custom-class')).toBe(true);
  });
});
