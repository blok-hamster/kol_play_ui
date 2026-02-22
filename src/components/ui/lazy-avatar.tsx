import React, { useState, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { cn } from '@/lib/utils'; // Assuming tailwind-merge util is here

interface LazyAvatarProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src?: string;
    fallbackSeed?: string;
    alt?: string;
    className?: string;
    /** Whether to use a simple text-based initial fallback if no image loads */
    useTextFallback?: boolean;
}

export function LazyAvatar({
    src,
    fallbackSeed = 'unknown',
    alt = 'Avatar',
    className,
    useTextFallback = false,
    ...props
}: LazyAvatarProps) {
    const { ref, inView } = useInView({
        triggerOnce: true, // Only load once when it comes into view
        rootMargin: '100px 0px', // Start loading slightly before it enters the viewport
    });

    const [hasError, setHasError] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    // Reset states if src changes
    useEffect(() => {
        setHasError(false);
        setIsLoaded(false);
    }, [src]);

    // Construct dicebear fallback
    // Use URI encoding to ensure special chars don't break the URL
    const dicebearUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fallbackSeed)}`;

    // Determine what URL to try loading
    // 1. If we haven't scrolled to it yet -> don't load anything (unless no src provided)
    // 2. If it threw an error (like unavatar rate limit) -> use dicebear
    // 3. Else -> use the provided src or dicebear if undefined

    let currentSrc = undefined;
    if (inView) {
        if (hasError || !src) {
            currentSrc = dicebearUrl;
        } else {
            currentSrc = src;
        }
    }

    // Handle image load error:
    // If the primary image fails, flag it so React swaps the src to dicebearUrl instantly
    const handleError = () => {
        if (!hasError) {
            setHasError(true);
        }
    };

    const handleLoad = () => {
        setIsLoaded(true);
    };

    if (useTextFallback && hasError) {
        // Sometimes we just want a colored CSS circle instead of a full image fallback
        const initials = fallbackSeed.substring(0, 2).toUpperCase();
        return (
            <div ref={ref} className={cn("bg-primary flex items-center justify-center text-primary-foreground font-bold shrink-0", className)}>
                {initials}
            </div>
        );
    }

    return (
        <div ref={ref} className={cn("relative overflow-hidden shrink-0 bg-muted/20", className)}>
            {currentSrc && (
                <img
                    src={currentSrc}
                    alt={alt}
                    className={cn(
                        "w-full h-full object-cover transition-opacity duration-300",
                        isLoaded ? "opacity-100" : "opacity-0"
                    )}
                    onError={handleError}
                    onLoad={handleLoad}
                    {...props}
                />
            )}
        </div>
    );
}
