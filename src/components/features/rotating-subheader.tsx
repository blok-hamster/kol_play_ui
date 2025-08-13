"use client";

import React, { useEffect, useMemo, useState } from 'react';

interface RotatingSubheaderProps {
  className?: string;
  intervalMs?: number;
}

const RotatingSubheader: React.FC<RotatingSubheaderProps> = ({ className = '', intervalMs = 2600 }) => {
  const phrases = useMemo(
    () => [
      'ML driven insights',
      'mind map kol strategies',
      'instant buy and sell',
      'KOL watch and subscribe',
      'token discovery',
      'community driven',
    ],
    []
  );

  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex(prev => (prev + 1) % phrases.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [phrases.length, intervalMs]);

  return (
    <p
      className={`text-xl text-foreground/90 max-w-3xl mx-auto transition-all duration-300 ${className} rounded-full border px-4 py-2 inline-block bg-[#7c3aed1a] border-[#7c3aed33]`}
    >
      {phrases[index]}
    </p>
  );
};

export default RotatingSubheader; 