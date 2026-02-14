"use client";

import { AnimatePresence, motion } from "motion/react";
import { Search, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@credopass/ui/lib/utils";
import { useIsMobile } from "../hooks/use-mobile";

type ExpandingSearchDockProps = {
  onSearch?: (query: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
};

export function ExpandingSearchDock({
  onSearch,
  className,
  placeholder = "Search...",
  disabled
}: ExpandingSearchDockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const isMobile = useIsMobile();


  // On mobile, dynamically calculate a width that fits the viewport
  // leaving room for other header elements (plus btn, spacer, secondary action)
  const expandedWidth = isMobile
    ? Math.min((typeof window !== 'undefined' ? window.innerWidth : 375) - 185, 260)
    : 320;

  const handleExpand = () => {
    if (disabled) return;
    setIsExpanded(true);
  };

  const handleCollapse = () => {
    setIsExpanded(false);
    setQuery("");
  };


  const handleSubmit = (e: React.FormEvent) => {
    console.log("Submitting search with query:", query);
    e.preventDefault();
    if (onSearch && query) {
      onSearch(query);
    }
  };

  const handleChange = useCallback(({ target: { value } }: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(value);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions, react-hooks/set-state-in-effect
    disabled && handleCollapse();
  }, [disabled]);


  return (
    <div className={cn("relative", className)}>
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          <motion.button
            key="icon"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={handleExpand}
            className={`flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card transition-colors ${disabled ? '' : 'hover:bg-muted'}`}
          >
            <Search className={`h-5 w-5 ${disabled ? "text-muted-foreground" : ""}`} />
          </motion.button>
        ) : (
          <motion.form
            key="input"
            initial={{ width: 48, opacity: 0 }}
            animate={{ width: expandedWidth, opacity: 1 }}
            exit={{ width: 48, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
            }}
            onChange={handleSubmit}
            className="relative"
          >
            <motion.div
              initial={{ backdropFilter: "blur(0px)" }}
              animate={{ backdropFilter: "blur(12px)" }}
              className="relative flex items-center gap-2 overflow-hidden rounded-full border border-border bg-card/80 backdrop-blur-md"
            >
              <div className="ml-4">
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
              <input
                type="text"
                value={query}
                onChange={handleChange}
                placeholder={placeholder}
                autoFocus
                className="h-8 flex-1 bg-transparent pr-4 text-sm outline-none placeholder:text-muted-foreground"
              />
              <motion.button
                type="button"
                onClick={handleCollapse}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="mr-2 flex h-5 w-5 items-center justify-center rounded-full hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </motion.button>
            </motion.div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
