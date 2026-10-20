import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from '../pagination';

describe('Pagination', () => {
  it('returns null when totalPages is 1', () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when totalPages is 0', () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={0} onPageChange={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders prev and next buttons', () => {
    render(<Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /previous page/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument();
  });

  it('renders page number buttons', () => {
    render(<Pagination currentPage={1} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /go to page 1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to page 2/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to page 3/i })).toBeInTheDocument();
  });

  it('marks current page with aria-current="page"', () => {
    render(<Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />);
    const currentPageBtn = screen.getByRole('button', { name: /go to page 2/i });
    expect(currentPageBtn).toHaveAttribute('aria-current', 'page');
  });

  it('calls onPageChange with next page when clicking next', async () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={2} totalPages={5} onPageChange={onPageChange} />);
    await userEvent.click(screen.getByRole('button', { name: /next page/i }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('calls onPageChange with previous page when clicking prev', async () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={3} totalPages={5} onPageChange={onPageChange} />);
    await userEvent.click(screen.getByRole('button', { name: /previous page/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange with correct page number when clicking a page button', async () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={1} totalPages={3} onPageChange={onPageChange} />);
    await userEvent.click(screen.getByRole('button', { name: /go to page 3/i }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('disables prev button on the first page', () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
  });

  it('disables next button on the last page', () => {
    render(<Pagination currentPage={5} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
  });

  it('does not disable prev when not on first page', () => {
    render(<Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /previous page/i })).not.toBeDisabled();
  });

  it('does not disable next when not on last page', () => {
    render(<Pagination currentPage={4} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /next page/i })).not.toBeDisabled();
  });
});
