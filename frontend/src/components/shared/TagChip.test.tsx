import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TagChip } from './TagChip';

describe('TagChip', () => {
  it('renders the tag name', () => {
    render(<TagChip name="typescript" />);
    expect(screen.getByText('typescript')).toBeInTheDocument();
  });

  it('renders with data-testid attribute', () => {
    render(<TagChip name="react" />);
    expect(screen.getByTestId('tag-chip')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<TagChip name="css" className="my-custom-class" />);
    expect(container.firstChild).toHaveClass('my-custom-class');
  });

  it('renders different tag names correctly', () => {
    const { rerender } = render(<TagChip name="node.js" />);
    expect(screen.getByText('node.js')).toBeInTheDocument();

    rerender(<TagChip name="prisma" />);
    expect(screen.getByText('prisma')).toBeInTheDocument();
  });
});
