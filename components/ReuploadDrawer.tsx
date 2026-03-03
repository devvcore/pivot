"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Upload, X, FileText, Loader2 } from "lucide-react";

const ACCEPTED = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.md";

interface ReuploadDrawerProps {
  runId: string;
  onReprocess: () => void;
}

export function ReuploadDrawer({ runId, onReprocess }: ReuploadDrawerProps) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const arr = Array.from(fileList).filter((f) => f.size <= 50 * 1024 * 1024);
    setFiles((prev) => [...prev, ...arr]);
    setError(null);
  }, []);

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpload = async () => {
    if (!files.length) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("runId", runId);
      for (const file of files) {
        formData.append("files", file);
      }

      const res = await fetch("/api/job/reupload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
      }

      // Success — close drawer and transition to processing view
      setOpen(false);
      setFiles([]);
      onReprocess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2 bg-zinc-900 text-white px-4 py-2.5 rounded-full shadow-lg hover:bg-zinc-800 transition-all group"
        title="Add more documents"
      >
        <Plus className="w-4 h-4" />
        <span className="text-xs font-medium">Add Docs</span>
      </button>

      {/* Drawer overlay */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => !uploading && setOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[70vh] overflow-y-auto"
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900">Add More Documents</h3>
                    <p className="text-sm text-zinc-500 mt-0.5">
                      Upload new files to re-run your analysis with updated data. Newer files take priority over older ones.
                    </p>
                  </div>
                  <button
                    onClick={() => !uploading && setOpen(false)}
                    className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-zinc-400" />
                  </button>
                </div>

                {/* Drop zone */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                  className="border-2 border-dashed border-zinc-200 rounded-2xl p-8 text-center cursor-pointer hover:border-zinc-400 transition-colors"
                >
                  <Upload className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
                  <p className="text-sm text-zinc-600 font-medium">
                    Drop files here or click to browse
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    PDF, DOCX, XLSX, CSV, PPTX, TXT (max 50MB each)
                  </p>
                  <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPTED}
                    multiple
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                </div>

                {/* File list */}
                {files.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {files.map((f, i) => (
                      <div
                        key={`${f.name}-${i}`}
                        className="flex items-center gap-3 bg-zinc-50 rounded-xl px-4 py-3"
                      >
                        <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                        <span className="text-sm text-zinc-700 flex-1 min-w-0 break-words">
                          {f.name}
                        </span>
                        <span className="text-xs text-zinc-400 shrink-0">
                          {(f.size / 1024).toFixed(0)} KB
                        </span>
                        {!uploading && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(i);
                            }}
                            className="p-1 hover:bg-zinc-200 rounded transition-colors"
                          >
                            <X className="w-3 h-3 text-zinc-400" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="mt-4 bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                {/* Upload button */}
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => !uploading && setOpen(false)}
                    disabled={uploading}
                    className="flex-1 py-3 text-sm font-medium text-zinc-600 bg-zinc-100 rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={!files.length || uploading}
                    className="flex-1 py-3 text-sm font-medium text-white bg-zinc-900 rounded-xl hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Re-analyzing...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Upload & Re-analyze ({files.length} file{files.length !== 1 ? "s" : ""})
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
