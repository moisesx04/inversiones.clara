"use client";

import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, X, AlertCircle, Info } from "lucide-react";

type ToastItem = {
  id: string;
  title: string;
  description?: string;
  type?: "success" | "error" | "info";
};

export function useToast() {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((title: string, description?: string, type: ToastItem["type"] = "info") => {
    const id = crypto.randomUUID();
    setItems((current) => [...current, { id, title, description, type }]);
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 4000);
  }, []);

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const ToastViewport = useCallback(
    () => (
      <div className="fixed top-4 right-4 z-[9999] grid w-[calc(100%-2rem)] max-w-sm gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {items.map((item) => {
            const Icon = item.type === "success"
              ? CheckCircle2
              : item.type === "error"
              ? AlertCircle
              : Info;
            const colors = item.type === "success"
              ? "border-emerald-200 bg-white"
              : item.type === "error"
              ? "border-red-200 bg-white"
              : "border-blue-200 bg-white";
            const iconColor = item.type === "success"
              ? "text-emerald-500"
              : item.type === "error"
              ? "text-red-500"
              : "text-blue-500";
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: -16, scale: 0.94, x: 20 }}
                animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
                exit={{ opacity: 0, y: -12, scale: 0.94, x: 20 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className={`pointer-events-auto flex items-start gap-3 rounded-xl border ${colors} p-4 shadow-lg shadow-black/[0.08] backdrop-blur-sm`}
              >
                <div className={`mt-0.5 flex-shrink-0 ${iconColor}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-900 leading-tight">{item.title}</p>
                  {item.description ? (
                    <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">{item.description}</p>
                  ) : null}
                </div>
                <button
                  onClick={() => dismiss(item.id)}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors mt-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    ),
    [items, dismiss],
  );

  return { toast, ToastViewport };
}
