import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useAbout, useAboutMutations } from '../../hooks/useAbout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { Skeleton } from '../../components/ui/skeleton';
import type { AboutSection, AboutSectionType } from '../../types';

// ── Zod schema ────────────────────────────────────────────────────────────────

const sectionSchema = z.object({
  type: z.enum(['education', 'experience', 'skill', 'contact']),
  title: z.string().min(1, 'Judul wajib diisi'),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  metadataUrl: z.string().url('URL tidak valid').optional().or(z.literal('')),
  metadataIcon: z.string().optional(),
});

type SectionFormData = z.infer<typeof sectionSchema>;

// ── Sortable row ──────────────────────────────────────────────────────────────

interface SortableRowProps {
  section: AboutSection;
  onEdit: (section: AboutSection) => void;
  onDelete: (section: AboutSection) => void;
}

function SortableRow({ section, onEdit, onDelete }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
      data-testid="sortable-row"
    >
      {/* Drag handle */}
      <button
        type="button"
        className="cursor-grab text-muted-foreground hover:text-foreground shrink-0 touch-none"
        aria-label="Seret untuk mengatur ulang"
        {...attributes}
        {...listeners}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="9" cy="5" r="1" />
          <circle cx="15" cy="5" r="1" />
          <circle cx="9" cy="12" r="1" />
          <circle cx="15" cy="12" r="1" />
          <circle cx="9" cy="19" r="1" />
          <circle cx="15" cy="19" r="1" />
        </svg>
      </button>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground text-sm truncate">{section.title}</p>
        {section.subtitle && (
          <p className="text-xs text-muted-foreground truncate">{section.subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onEdit(section)}
          aria-label={`Edit ${section.title}`}
        >
          Edit
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => onDelete(section)}
          aria-label={`Hapus ${section.title}`}
          data-testid="delete-button"
        >
          Hapus
        </Button>
      </div>
    </div>
  );
}

// ── Tab content (sortable list + add button) ──────────────────────────────────

interface TabSectionProps {
  type: AboutSectionType;
  sections: AboutSection[];
  onAdd: (type: AboutSectionType) => void;
  onEdit: (section: AboutSection) => void;
  onDelete: (section: AboutSection) => void;
  onReorder: (type: AboutSectionType, sections: AboutSection[]) => void;
}

function TabSection({ type, sections, onAdd, onEdit, onDelete, onReorder }: TabSectionProps) {
  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === over.id);
      const reordered = arrayMove(sections, oldIndex, newIndex);
      onReorder(type, reordered);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() => onAdd(type)}
          data-testid="add-section-button"
        >
          + Tambah Seksi
        </Button>
      </div>

      {sections.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Belum ada entri. Klik "Tambah Seksi" untuk menambahkan.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {sections.map((section) => (
                <SortableRow
                  key={section.id}
                  section={section}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

// ── Section form dialog ───────────────────────────────────────────────────────

interface SectionDialogProps {
  open: boolean;
  defaultType?: AboutSectionType;
  editTarget?: AboutSection | null;
  onClose: () => void;
  onSave: (data: SectionFormData, editId?: string) => void;
  isSaving: boolean;
}

const TYPE_LABELS: Record<AboutSectionType, string> = {
  education: 'Pendidikan',
  experience: 'Pengalaman',
  skill: 'Keahlian',
  contact: 'Kontak',
};

function SectionDialog({
  open,
  defaultType,
  editTarget,
  onClose,
  onSave,
  isSaving,
}: SectionDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SectionFormData>({
    resolver: zodResolver(sectionSchema),
    values: editTarget
      ? {
          type: editTarget.type,
          title: editTarget.title,
          subtitle: editTarget.subtitle ?? '',
          description: editTarget.description ?? '',
          startDate: editTarget.startDate
            ? editTarget.startDate.slice(0, 10)
            : '',
          endDate: editTarget.endDate ? editTarget.endDate.slice(0, 10) : '',
          metadataUrl: editTarget.metadata?.url ?? '',
          metadataIcon: editTarget.metadata?.icon ?? '',
        }
      : {
          type: defaultType ?? 'experience',
          title: '',
          subtitle: '',
          description: '',
          startDate: '',
          endDate: '',
          metadataUrl: '',
          metadataIcon: '',
        },
  });

  function handleClose() {
    reset();
    onClose();
  }

  function onSubmit(data: SectionFormData) {
    onSave(data, editTarget?.id);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editTarget ? 'Edit Seksi' : 'Tambah Seksi'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Type selector */}
          <div className="flex flex-col gap-1">
            <label htmlFor="section-type" className="text-sm font-medium text-foreground">
              Tipe
            </label>
            <select
              id="section-type"
              {...register('type')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              disabled={!!editTarget}
            >
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {errors.type && (
              <p className="text-sm text-destructive">{errors.type.message}</p>
            )}
          </div>

          {/* Title */}
          <div className="flex flex-col gap-1">
            <label htmlFor="section-title" className="text-sm font-medium text-foreground">
              Judul <span className="text-destructive">*</span>
            </label>
            <Input
              id="section-title"
              {...register('title')}
              placeholder="Judul seksi"
              aria-invalid={!!errors.title}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Subtitle */}
          <div className="flex flex-col gap-1">
            <label htmlFor="section-subtitle" className="text-sm font-medium text-foreground">
              Subjudul
            </label>
            <Input
              id="section-subtitle"
              {...register('subtitle')}
              placeholder="Instansi / perusahaan / detail"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label htmlFor="section-description" className="text-sm font-medium text-foreground">
              Deskripsi
            </label>
            <Textarea
              id="section-description"
              {...register('description')}
              placeholder="Deskripsi singkat"
              rows={3}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="section-start" className="text-sm font-medium text-foreground">
                Tanggal Mulai
              </label>
              <Input id="section-start" type="date" {...register('startDate')} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="section-end" className="text-sm font-medium text-foreground">
                Tanggal Selesai
              </label>
              <Input
                id="section-end"
                type="date"
                {...register('endDate')}
                placeholder="Kosongkan jika masih berjalan"
              />
            </div>
          </div>

          {/* Metadata URL */}
          <div className="flex flex-col gap-1">
            <label htmlFor="section-url" className="text-sm font-medium text-foreground">
              URL (untuk kontak)
            </label>
            <Input
              id="section-url"
              {...register('metadataUrl')}
              placeholder="https://..."
            />
            {errors.metadataUrl && (
              <p className="text-sm text-destructive">{errors.metadataUrl.message}</p>
            )}
          </div>

          {/* Metadata icon */}
          <div className="flex flex-col gap-1">
            <label htmlFor="section-icon" className="text-sm font-medium text-foreground">
              Ikon (github / linkedin / email / twitter / website)
            </label>
            <Input
              id="section-icon"
              {...register('metadataIcon')}
              placeholder="github"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Batal
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TABS: { value: AboutSectionType; label: string }[] = [
  { value: 'experience', label: 'Pengalaman' },
  { value: 'education', label: 'Pendidikan' },
  { value: 'skill', label: 'Keahlian' },
  { value: 'contact', label: 'Kontak' },
];

export default function AboutAdminPage() {
  const { data: sections = [], isLoading } = useAbout();
  const { create, update, remove, reorder } = useAboutMutations();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDefaultType, setDialogDefaultType] = useState<AboutSectionType>('experience');
  const [editTarget, setEditTarget] = useState<AboutSection | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AboutSection | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Group sections by type, sorted by order
  const grouped = sections.reduce<Record<AboutSectionType, AboutSection[]>>(
    (acc, s) => {
      const key = s.type as AboutSectionType;
      if (!acc[key]) acc[key] = [];
      acc[key].push(s);
      return acc;
    },
    { experience: [], education: [], skill: [], contact: [] },
  );

  // Sort each group by order
  Object.values(grouped).forEach((arr) => arr.sort((a, b) => a.order - b.order));

  function handleAdd(type: AboutSectionType) {
    setEditTarget(null);
    setDialogDefaultType(type);
    setDialogOpen(true);
  }

  function handleEdit(section: AboutSection) {
    setEditTarget(section);
    setDialogDefaultType(section.type);
    setDialogOpen(true);
  }

  function handleDeleteRequest(section: AboutSection) {
    setDeleteTarget(section);
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setMutationError(null);
    remove.mutate(deleteTarget.id, {
      onError: () => setMutationError('Gagal menghapus seksi.'),
      onSettled: () => setDeleteTarget(null),
    });
  }

  function handleReorder(_type: AboutSectionType, reordered: AboutSection[]) {
    const items = reordered.map((s, index) => ({ id: s.id, order: index }));
    reorder.mutate(items, {
      onError: () => setMutationError('Gagal menyimpan urutan baru.'),
    });
  }

  function handleSave(data: SectionFormData, editId?: string) {
    setMutationError(null);

    const metadata: Record<string, string> = {};
    if (data.metadataUrl) metadata.url = data.metadataUrl;
    if (data.metadataIcon) metadata.icon = data.metadataIcon;

    const payload = {
      type: data.type,
      title: data.title,
      subtitle: data.subtitle || undefined,
      description: data.description || undefined,
      startDate: data.startDate || undefined,
      endDate: data.endDate || undefined,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };

    if (editId) {
      update.mutate(
        { id: editId, payload },
        {
          onSuccess: () => setDialogOpen(false),
          onError: () => setMutationError('Gagal menyimpan perubahan.'),
        },
      );
    } else {
      create.mutate(payload, {
        onSuccess: () => setDialogOpen(false),
        onError: () => setMutationError('Gagal membuat seksi baru.'),
      });
    }
  }

  const isSaving = create.isPending || update.isPending;

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Kelola About</h1>
        <p className="mt-1 text-muted-foreground">
          Atur konten halaman About: pengalaman, pendidikan, keahlian, dan kontak.
        </p>
      </div>

      {mutationError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {mutationError}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
      ) : (
        <Tabs defaultValue="experience">
          <TabsList>
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="mt-4">
              <TabSection
                type={tab.value}
                sections={grouped[tab.value]}
                onAdd={handleAdd}
                onEdit={handleEdit}
                onDelete={handleDeleteRequest}
                onReorder={handleReorder}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Section form dialog */}
      <SectionDialog
        open={dialogOpen}
        defaultType={dialogDefaultType}
        editTarget={editTarget}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        isSaving={isSaving}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus seksi?</AlertDialogTitle>
            <AlertDialogDescription>
              Seksi "{deleteTarget?.title}" akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-button"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
