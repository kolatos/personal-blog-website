import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TagInput } from './TagInput';
import * as tagsApi from '../../api/tags';

// Mock the getTags API call
vi.mock('../../api/tags', () => ({
  getTags: vi.fn(),
}));

const mockTags = [
  { id: '1', name: 'typescript', slug: 'typescript' },
  { id: '2', name: 'react', slug: 'react' },
  { id: '3', name: 'node.js', slug: 'nodejs' },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('TagInput', () => {
  beforeEach(() => {
    vi.mocked(tagsApi.getTags).mockResolvedValue(mockTags);
  });

  it('renders the input field', () => {
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByTestId('tag-input-field')).toBeInTheDocument();
  });

  it('adds a tag via Enter key', async () => {
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} />, {
      wrapper: createWrapper(),
    });

    const input = screen.getByTestId('tag-input-field');
    await userEvent.type(input, 'javascript');
    await userEvent.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith(['javascript']);
  });

  it('normalizes tag name to lowercase on add', async () => {
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} />, {
      wrapper: createWrapper(),
    });

    const input = screen.getByTestId('tag-input-field');
    await userEvent.type(input, 'TypeScript');
    await userEvent.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith(['typescript']);
  });

  it('removes a tag when × button is clicked', async () => {
    const onChange = vi.fn();
    render(<TagInput value={['react', 'typescript']} onChange={onChange} />, {
      wrapper: createWrapper(),
    });

    const removeButton = screen.getByTestId('remove-tag-react');
    await userEvent.click(removeButton);

    expect(onChange).toHaveBeenCalledWith(['typescript']);
  });

  it('displays existing tags as chips', () => {
    const onChange = vi.fn();
    render(<TagInput value={['react', 'typescript']} onChange={onChange} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByTestId('tag-item-react')).toBeInTheDocument();
    expect(screen.getByTestId('tag-item-typescript')).toBeInTheDocument();
  });

  it('shows autocomplete suggestions when typing', async () => {
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} />, {
      wrapper: createWrapper(),
    });

    const input = screen.getByTestId('tag-input-field');
    await userEvent.type(input, 'ty');

    // Wait for suggestions to appear
    await waitFor(() => {
      expect(screen.getByTestId('suggestion-typescript')).toBeInTheDocument();
    });
  });

  it('does not add duplicate tags', async () => {
    const onChange = vi.fn();
    render(<TagInput value={['react']} onChange={onChange} />, {
      wrapper: createWrapper(),
    });

    const input = screen.getByTestId('tag-input-field');
    await userEvent.type(input, 'react');
    await userEvent.keyboard('{Enter}');

    // onChange should NOT be called since 'react' is already in the list
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not add empty tags', async () => {
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} />, {
      wrapper: createWrapper(),
    });

    const input = screen.getByTestId('tag-input-field');
    await userEvent.click(input);
    await userEvent.keyboard('{Enter}');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('removes last tag with Backspace on empty input', async () => {
    const onChange = vi.fn();
    render(<TagInput value={['react', 'typescript']} onChange={onChange} />, {
      wrapper: createWrapper(),
    });

    const input = screen.getByTestId('tag-input-field');
    await userEvent.click(input);
    await userEvent.keyboard('{Backspace}');

    expect(onChange).toHaveBeenCalledWith(['react']);
  });
});
