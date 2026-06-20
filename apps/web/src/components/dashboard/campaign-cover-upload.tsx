"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_BYTES = 5 * 1024 * 1024;

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/ipfs/upload-image", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Upload failed");
  }
  const { url } = await res.json();
  return url as string;
}

export function CampaignCoverUpload({
  value,
  onChange,
  disabled = false,
  compact = false,
  size = "default",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
  compact?: boolean;
  size?: "default" | "compact" | "small";
}) {
  const resolvedSize = size === "default" && compact ? "compact" : size;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(value);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPreview(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const applyFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("Please choose an image file (JPG, PNG, WebP, or GIF).");
        return;
      }
      if (file.size > MAX_BYTES) {
        setError("Image must be under 5 MB.");
        return;
      }
      setError(null);
      const blobUrl = URL.createObjectURL(file);
      setPreview(blobUrl);
      setUploading(true);
      try {
        const url = await uploadImage(file);
        onChange(url);
        setPreview(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload image");
        setPreview(value);
        onChange(value);
      } finally {
        setUploading(false);
      }
    },
    [onChange, value],
  );

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void applyFile(file);
  };

  const clear = () => {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview(null);
    onChange(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      {preview ? (
        <div className="relative overflow-hidden rounded-xl border border-[#e8e8e3]">
          <div
            className={cn(
              "relative w-full bg-muted",
              resolvedSize === "small" && "h-28 w-full",
              resolvedSize === "compact" && "aspect-[4/3] max-w-sm",
              resolvedSize === "default" && "aspect-[2.4/1]",
            )}
          >
            <Image
              src={preview}
              alt="Campaign cover"
              fill
              className="object-cover"
              unoptimized
            />
            {uploading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
            ) : null}
          </div>
          {!disabled && !uploading ? (
            <button
              type="button"
              onClick={clear}
              className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
              aria-label="Remove cover image"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#e8e8e3] bg-[#f9f8f4] px-4 text-sm text-muted-foreground transition-colors",
            resolvedSize === "small" && "h-28 w-full py-4",
            resolvedSize === "compact" && "py-5",
            resolvedSize === "default" && "py-8",
            !disabled && "hover:border-delulu-blue/40 hover:text-foreground",
            disabled && "opacity-50",
          )}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <ImagePlus className="h-6 w-6" />
          )}
          <span>{uploading ? "Uploading…" : "Add cover image (optional)"}</span>
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled || uploading}
        onChange={handleSelect}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
