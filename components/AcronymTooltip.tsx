"use client";

import { useState, useRef, useEffect, Fragment } from "react";
import { ACRONYMS, findAcronyms } from "@/lib/acronyms";

interface AcronymTextProps {
  text: string;
  className?: string;
}

/** Tooltip that appears on hover over an acronym */
function AcronymSpan({ acronym, definition }: { acronym: string; definition: string }) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState<"above" | "below">("above");
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (show && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      // If too close to top, show below
      if (rect.top < 80) {
        setPosition("below");
      } else {
        setPosition("above");
      }
    }
  }, [show]);

  return (
    <span
      ref={ref}
      className="relative inline-block cursor-help border-b border-dotted border-zinc-400"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {acronym}
      {show && (
        <span
          className={`absolute z-50 left-1/2 -translate-x-1/2 px-2.5 py-1.5 bg-zinc-900 text-white text-[10px] leading-tight rounded-lg shadow-lg whitespace-nowrap max-w-[260px] text-wrap pointer-events-none ${
            position === "above" ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}
        >
          <span className="font-semibold">{acronym}</span>
          <span className="text-zinc-300"> — {definition}</span>
        </span>
      )}
    </span>
  );
}

/**
 * Renders text with hover tooltips on recognized business acronyms.
 * Acronyms get a subtle dotted underline and show their definition on hover.
 */
export function AcronymText({ text, className }: AcronymTextProps) {
  if (!text) return null;

  const found = findAcronyms(text);
  if (found.length === 0) {
    return <span className={className}>{text}</span>;
  }

  // Build segments: alternating text and acronym spans
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;

  for (let i = 0; i < found.length; i++) {
    const { acronym, definition, index } = found[i];

    // Text before this acronym
    if (index > lastIndex) {
      segments.push(
        <Fragment key={`t-${i}`}>{text.slice(lastIndex, index)}</Fragment>
      );
    }

    // The acronym with tooltip
    segments.push(
      <AcronymSpan key={`a-${i}`} acronym={acronym} definition={definition} />
    );

    lastIndex = index + acronym.length;
  }

  // Remaining text after last acronym
  if (lastIndex < text.length) {
    segments.push(
      <Fragment key="tail">{text.slice(lastIndex)}</Fragment>
    );
  }

  return <span className={className}>{segments}</span>;
}
