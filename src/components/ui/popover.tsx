'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface PopoverProps {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

interface PopoverTriggerProps {
    children: React.ReactNode;
    asChild?: boolean;
}

interface PopoverContentProps {
    children: React.ReactNode;
    align?: 'start' | 'center' | 'end';
    className?: string;
    sideOffset?: number;
}

const PopoverContext = React.createContext<{
    open: boolean;
    setOpen: (open: boolean) => void;
}>({
    open: false,
    setOpen: () => { },
});

export const Popover: React.FC<PopoverProps> = ({
    children,
    open: controlledOpen,
    onOpenChange,
}) => {
    const [internalOpen, setInternalOpen] = React.useState(false);
    const open = controlledOpen !== undefined ? controlledOpen : internalOpen;

    const setOpen = React.useCallback((newOpen: boolean) => {
        if (controlledOpen === undefined) {
            setInternalOpen(newOpen);
        }
        onOpenChange?.(newOpen);
    }, [controlledOpen, onOpenChange]);

    return (
        <PopoverContext.Provider value={{ open, setOpen }}>
            <div className="relative inline-block">
                {children}
            </div>
        </PopoverContext.Provider>
    );
};

export const PopoverTrigger: React.FC<PopoverTriggerProps> = ({
    children,
    asChild = false,
}) => {
    const { open, setOpen } = React.useContext(PopoverContext);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent bubbling issues
        setOpen(!open);
    };

    if (asChild) {
        return React.cloneElement(children as React.ReactElement, {
            onClick: handleClick,
        });
    }

    return (
        <button onClick={handleClick} type="button">
            {children}
        </button>
    );
};

export const PopoverContent: React.FC<PopoverContentProps> = ({
    children,
    align = 'center',
    className,
    sideOffset = 4,
}) => {
    const { open, setOpen } = React.useContext(PopoverContext);
    const contentRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Check if the click is outside the popover content
            // Note: Trigger click is handled by its own handler which toggles state
            if (
                open &&
                contentRef.current &&
                !contentRef.current.contains(event.target as Node)
            ) {
                // We rely on the event bubbling order or checking if target is trigger.
                // A simple way is to just close it. If the trigger was clicked, 
                // it acts as a toggle. If we close here, the trigger click might reopen it immediately 
                // if not handled carefully.
                // However, since Trigger has e.stopPropagation(), valid outside clicks shouldn't be the trigger.
                setOpen(false);
            }
        };

        if (open) {
            document.addEventListener('click', handleClickOutside); // Changed to click to allow interaction
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [open, setOpen]);

    if (!open) return null;

    const alignmentClasses = {
        start: 'left-0',
        center: 'left-1/2 -translate-x-1/2',
        end: 'right-0',
    };

    return (
        <div
            ref={contentRef}
            style={{ marginTop: sideOffset }}
            className={cn(
                'absolute top-full z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95',
                alignmentClasses[align],
                className
            )}
        >
            {children}
        </div>
    );
};
