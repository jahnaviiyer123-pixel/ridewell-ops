import React, { useState } from "react";
import { api, formatApiError, API } from "@/lib/api";
import { CameraIcon, XIcon } from "@phosphor-icons/react";
import { toast } from "sonner";

/**
 * Reusable photo uploader.
 * - value: existing photo url (relative like /api/files/... or absolute)
 * - onChange(url|null): called after upload or remove
 * - size: tailwind size class for square (default w-24 h-24)
 */
export default function PhotoUploader({ value, onChange, size = "w-24 h-24" }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = React.useRef(null);
  const token = typeof window !== "undefined" ? localStorage.getItem("rw_token") : null;

  // Build absolute URL with auth query so <img> works
  const imgSrc = (() => {
    if (!value) return null;
    if (value.startsWith("http")) return value;
    const base = API.replace(/\/api$/, "");
    const sep = value.includes("?") ? "&" : "?";
    return `${base}${value}${token ? `${sep}auth=${token}` : ""}`;
  })();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/uploads/photo", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onChange(data.url);
      toast.success("Photo uploaded");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className={`${size} bg-zinc-100 border border-zinc-300 overflow-hidden flex items-center justify-center relative`}>
        {imgSrc ? (
          <img src={imgSrc} alt="" className="w-full h-full object-cover" />
        ) : (
          <CameraIcon size={28} weight="bold" className="text-zinc-400" />
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="text-white text-[10px] font-bold uppercase tracking-wider">
              Uploading…
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          ref={fileRef}
          onChange={handleFile}
          className="hidden"
          data-testid="photo-file-input"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          data-testid="upload-photo-btn"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border border-zinc-300 hover:bg-zinc-100 disabled:opacity-50"
        >
          <CameraIcon size={12} weight="bold" />
          {value ? "Change" : "Upload"} photo
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border border-zinc-300 hover:bg-red-600 hover:text-white hover:border-red-600"
          >
            <XIcon size={12} weight="bold" /> Remove
          </button>
        )}
      </div>
    </div>
  );
}
