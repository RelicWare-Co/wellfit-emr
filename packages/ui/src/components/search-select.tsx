"use client";

import { cn } from "@wellfit-emr/ui/lib/utils";
import { ChevronDown, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Skeleton } from "./skeleton";

export interface SearchSelectOption {
  description?: string;
  label: string;
  value: string;
}

interface SearchSelectProps {
  className?: string;
  clearable?: boolean;
  disabled?: boolean;
  emptyMessage?: string;
  id?: string;
  loading?: boolean;
  name?: string;
  onBlur?: () => void;
  onChange: (value: string) => void;
  onSearchChange: (search: string) => void;
  options: SearchSelectOption[];
  placeholder?: string;
  required?: boolean;
  search: string;
  value: string;
}

export function SearchSelect({
  value,
  onChange,
  search,
  onSearchChange,
  options,
  loading = false,
  placeholder = "Buscar...",
  emptyMessage = "No hay resultados",
  disabled = false,
  clearable = true,
  className,
  id,
  name,
  onBlur,
  required = false,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((o) => o.value === value);
  const displayValue = selectedOption ? selectedOption.label : search;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleFocus() {
    setOpen(true);
    if (value && inputRef.current) {
      inputRef.current.select();
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (value) {
      onChange("");
    }
    onSearchChange(e.target.value);
    setOpen(true);
  }

  function handleSelect(option: SearchSelectOption) {
    onChange(option.value);
    onSearchChange(option.label);
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleClear() {
    onChange("");
    onSearchChange("");
    setOpen(false);
  }

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <div className="relative">
        <Input
          aria-activedescendant={
            selectedOption ? `${id}-option-${selectedOption.value}` : undefined
          }
          aria-autocomplete="list"
          aria-controls={open ? `${id}-listbox` : undefined}
          aria-expanded={open}
          className="pr-16"
          disabled={disabled}
          id={id}
          name={name}
          onBlur={() => {
            setTimeout(() => {
              if (!containerRef.current?.contains(document.activeElement)) {
                setOpen(false);
                onBlur?.();
              }
            }, 120);
          }}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          ref={inputRef}
          required={required}
          value={displayValue}
        />
        <div className="absolute top-0 right-0 flex h-8 items-center">
          {clearable && value && (
            <Button
              onClick={handleClear}
              size="icon-xs"
              tabIndex={-1}
              type="button"
              variant="ghost"
            >
              <X size={12} />
            </Button>
          )}
          <Button
            onClick={() => setOpen((o) => !o)}
            size="icon-xs"
            tabIndex={-1}
            type="button"
            variant="ghost"
          >
            <ChevronDown size={12} />
          </Button>
        </div>
      </div>

      {open && (
        <div
          className="absolute z-50 mt-1 w-full border border-input bg-popover shadow-md"
          id={`${id}-listbox`}
          role="listbox"
        >
          {(() => {
            if (loading) {
              return (
                <div className="space-y-1 p-2">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                </div>
              );
            }
            if (options.length === 0) {
              return (
                <div className="flex items-center gap-2 px-2.5 py-2 text-muted-foreground text-xs">
                  <Search size={12} />
                  {emptyMessage}
                </div>
              );
            }
            return (
              <div className="max-h-48 overflow-auto">
                {options.map((opt) => (
                  <button
                    aria-selected={opt.value === value}
                    className={cn(
                      "w-full px-2.5 py-1.5 text-left text-xs outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                      opt.value === value && "bg-accent text-accent-foreground"
                    )}
                    id={`${id}-option-${opt.value}`}
                    key={opt.value}
                    onClick={() => handleSelect(opt)}
                    onMouseDown={(e) => e.preventDefault()}
                    role="option"
                    type="button"
                  >
                    <div className="font-medium">{opt.label}</div>
                    {opt.description && (
                      <div className="text-[10px] text-muted-foreground">
                        {opt.description}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
