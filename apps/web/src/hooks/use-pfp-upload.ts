"use client";

import { useState, useRef } from "react";
import { useUserStore } from "@/stores/useUserStore";
import { useAccount } from "wagmi";

export interface UsePfpUploadReturn {
  upload: (file: File) => Promise<string>;
  isUploading: boolean;
  error: string | null;
  inputRef: React.RefObject<HTMLInputElement>;
  openPicker: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function usePfpUpload(): UsePfpUploadReturn {
  const { updateProfile } = useUserStore();
  const { address } = useAccount();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File): Promise<string> => {
    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (!address) {
        throw new Error("Wallet address not available. Please reconnect and try again.");
      }
      formData.append("address", address);

      const uploadRes = await fetch("/api/profile/upload-image", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData?.error ?? "Image upload failed");

      const pfpUrl: string = uploadData.url;

      const persistRes = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, pfpUrl }),
      });
      const persistData = await persistRes.json().catch(() => ({}));
      if (!persistRes.ok) {
        throw new Error(persistData?.error ?? "Failed to save profile image");
      }

      updateProfile({ pfpUrl });

      return pfpUrl;
    } catch (err: any) {
      const msg = err?.message ?? "Upload failed";
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const openPicker = () => inputRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      await upload(file);
    } catch {}
  };

  return { upload, isUploading, error, inputRef, openPicker, onFileChange };
}
