'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export interface SelectItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export interface SelectTriggerProps {
  children: React.ReactNode;
  className?: string;
}

export interface SelectContentProps {
  children: React.ReactNode;
  className?: string;
}

export interface SelectValueProps {
  placeholder?: string;
  className?: string;
}

const SelectContext = React.createContext<{
  value: string;
  onValueChange: (value: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  disabled?: boolean;
}>({
  value: '',
  onValueChange: () => {},
  isOpen: false,
  setIsOpen: () => {},
});

const Select: React.FC<SelectProps> = ({
  value,
  onValueChange,
  children,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <SelectContext.Provider
      value={{ value, onValueChange, isOpen, setIsOpen, disabled }}
    >
      <div className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  );
};

const SelectTrigger: React.FC<SelectTriggerProps> = ({
  children,
  className,
}) => {
  const { isOpen, setIsOpen, disabled } = React.useContext(SelectContext);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, setIsOpen]);

  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={() => !disabled && setIsOpen(!isOpen)}
      disabled={disabled}
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
    >
      {children}
      <ChevronDown className={cn(
        'h-4 w-4 opacity-50 transition-transform',
        isOpen && 'rotate-180'
      )} />
    </button>
  );
};

const SelectValue: React.FC<SelectValueProps> = ({
  placeholder = 'Select an option...',
}) => {
  const { value } = React.useContext(SelectContext);
  
  return (
    <span className={cn(!value && 'text-muted-foreground')}>
      {value || placeholder}
    </span>
  );
};

const SelectContent: React.FC<SelectContentProps> = ({
  children,
  className,
}) => {
  const { isOpen } = React.useContext(SelectContext);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'absolute top-full left-0 z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg overflow-hidden',
        className
      )}
    >
      <div className="max-h-60 overflow-y-auto p-1">
        {children}
      </div>
    </div>
  );
};

const SelectItem: React.FC<SelectItemProps> = ({
  value,
  children,
  className,
}) => {
  const { value: selectedValue, onValueChange, setIsOpen } = React.useContext(SelectContext);
  const isSelected = value === selectedValue;

  return (
    <div
      onClick={() => {
        onValueChange(value);
        setIsOpen(false);
      }}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-md py-2 px-2 text-sm outline-none hover:bg-muted focus:bg-muted',
        isSelected && 'bg-muted',
        className
      )}
    >
      <span className="flex-1">{children}</span>
      {isSelected && (
        <Check className="h-4 w-4 ml-2" />
      )}
    </div>
  );
};

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }; 