import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAboutSections,
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
} from '../api/about';
import type { CreateSectionPayload, UpdateSectionPayload, ReorderItem } from '../api/about';

const QUERY_KEY = ['about-sections'];

/**
 * Hook to read all about sections.
 */
export function useAbout() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: getAboutSections,
  });
}

/**
 * Mutation hooks for admin about section management.
 */
export function useAboutMutations() {
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }

  const create = useMutation({
    mutationFn: (payload: CreateSectionPayload) => createSection(payload),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateSectionPayload }) =>
      updateSection(id, payload),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteSection(id),
    onSuccess: invalidate,
  });

  const reorder = useMutation({
    mutationFn: (items: ReorderItem[]) => reorderSections(items),
    onSuccess: invalidate,
  });

  return { create, update, remove, reorder };
}
