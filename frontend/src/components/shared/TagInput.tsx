import { useState, useRef, KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTags } from '../../api/tags';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '../ui/command';
import { Badge } from '../ui/badge';

interface TagInputProps {
  /** Currently selected tag names */
  value: string[];
  /** Called with the updated tag names array whenever tags change */
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}

/**
 * Tag input with autocomplete using shadcn Command + Popover.
 * - Type a tag name and press Enter to add it.
 * - Click × on a tag chip to remove it.
 * - Suggestions are fetched from GET /api/tags with staleTime: Infinity.
 */
function TagInput({ value, onChange, disabled = false }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch all available tags for autocomplete suggestions
  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: getTags,
    staleTime: Infinity,
  });

  function addTag(name: string) {
    const normalized = name.trim().toLowerCase();
    if (!normalized) return;
    if (value.includes(normalized)) return;
    onChange([...value, normalized]);
    setInputValue('');
    setOpen(false);
  }

  function removeTag(name: string) {
    onChange(value.filter((t) => t !== name));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    }
    // Backspace on empty input removes the last tag
    if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  // Filter suggestions: exclude already-selected tags, match input
  const suggestions = allTags.filter(
    (tag) =>
      !value.includes(tag.name) &&
      tag.name.includes(inputValue.trim().toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-2" data-testid="tag-input">
      {/* Existing tags */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5" data-testid="tag-list">
          {value.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="gap-1 pr-1"
              data-testid={`tag-item-${tag}`}
            >
              {tag}
              <button
                type="button"
                aria-label={`Hapus tag ${tag}`}
                data-testid={`remove-tag-${tag}`}
                onClick={() => removeTag(tag)}
                disabled={disabled}
                className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5 focus:outline-none focus:ring-1 focus:ring-ring"
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Input + dropdown */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {/* Invisible trigger — the real input is inside */}
          <div className="w-full" />
        </PopoverTrigger>

        {/* The actual text input lives outside the trigger for UX simplicity */}
        <div
          className="flex items-center border border-input rounded-md px-3 py-2 text-sm bg-background focus-within:ring-2 focus-within:ring-ring"
          onClick={() => inputRef.current?.focus()}
        >
          <input
            ref={inputRef}
            data-testid="tag-input-field"
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setOpen(e.target.value.trim().length > 0);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (inputValue.trim()) setOpen(true);
            }}
            placeholder="Tambah tag... (Enter untuk menambah)"
            disabled={disabled}
            className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
            aria-label="Input tag"
          />
        </div>

        {open && suggestions.length > 0 && (
          <PopoverContent
            className="w-64 p-0"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <Command>
              <CommandList>
                <CommandEmpty>Tidak ada saran.</CommandEmpty>
                <CommandGroup>
                  {suggestions.map((tag) => (
                    <CommandItem
                      key={tag.id}
                      value={tag.name}
                      data-testid={`suggestion-${tag.name}`}
                      onSelect={() => addTag(tag.name)}
                    >
                      {tag.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        )}
      </Popover>
    </div>
  );
}

export { TagInput };
export type { TagInputProps };
