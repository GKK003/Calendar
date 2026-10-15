import { supabase } from "./supabase.js";

const PART = 16 * 1024 * 1024; // 16 MB pieces (R2 needs 5 MB or more except the last)
const PARALLEL = 3;

// Ask the Supabase Edge Function "r2" to do something with the R2 bucket
export async function r2(body) {
  const { data, error } = await supabase.functions.invoke("r2", { body });
  if (error) {
    let msg = error.message;
    try {
      const j = await error.context?.json?.();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg || "R2 request failed");
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

function putWithProgress(url, blob, onBytes, track, headers = {}) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    track(x);
    x.open("PUT", url);
    Object.entries(headers).forEach(([k, v]) => x.setRequestHeader(k, v));
    let last = 0;
    x.upload.onprogress = (e) => {
      onBytes(e.loaded - last);
      last = e.loaded;
    };
    x.onload = () => {
      if (x.status >= 200 && x.status < 300) {
        onBytes(blob.size - last);
        return resolve(x.getResponseHeader("ETag"));
      }
      onBytes(-last);
      reject(new Error("Part upload failed (" + x.status + ")"));
    };
    x.onerror = () => {
      onBytes(-last);
      reject(new Error("Network error during upload"));
    };
    x.onabort = () => {
      onBytes(-last);
      reject(new Error("cancelled"));
    };
    x.send(blob);
  });
}

// Upload a big file to R2 in pieces. Returns the R2 key.
export async function uploadToR2({ file, onProgress, onCancel }) {
  const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
  const type = file.type || "video/mp4";
  const { key, uploadId } = await r2({
    action: "create",
    ext,
    contentType: type,
  });

  const xhrs = new Set();
  let cancelled = false;
  onCancel?.(() => {
    cancelled = true;
    xhrs.forEach((x) => x.abort());
  });

  let sent = 0;
  const bump = (n) => {
    sent += n;
    onProgress(Math.min(99, Math.round((sent / file.size) * 100)));
  };
  const total = Math.max(1, Math.ceil(file.size / PART));
  const parts = [];
  let next = 1;

  const worker = async () => {
    while (!cancelled) {
      const n = next++;
      if (n > total) return;
      const blob = file.slice((n - 1) * PART, n * PART);
      let etag = null;
      for (let attempt = 1; attempt <= 4 && !etag; attempt++) {
        try {
          const { url } = await r2({
            action: "part",
            key,
            uploadId,
            partNumber: n,
          });
          etag = await putWithProgress(url, blob, bump, (x) => xhrs.add(x));
          if (!etag)
            throw new Error(
              "Missing ETag. Check the CORS settings on your R2 bucket (ExposeHeaders must include ETag).",
            );
        } catch (e) {
          if (cancelled || e.message === "cancelled")
            throw new Error("cancelled");
          if (attempt === 4 || /ETag/.test(e.message)) throw e;
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }
      parts.push({ n, etag });
    }
  };

  try {
    await Promise.all(
      Array.from({ length: Math.min(PARALLEL, total) }, worker),
    );
    if (cancelled) throw new Error("cancelled");
    await r2({ action: "complete", key, uploadId, parts });
    onProgress(100);
    return key;
  } catch (e) {
    xhrs.forEach((x) => x.abort());
    r2({ action: "abort", key, uploadId }).catch(() => {});
    throw e;
  }
}

// Small file (poster) straight to R2
export async function putSmall(key, blob) {
  const { url } = await r2({ action: "put", key });
  const res = await fetch(url, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": blob.type || "image/jpeg" },
  });
  if (!res.ok) throw new Error("Poster upload failed");
}

// Grab a frame from the video as the poster (best effort, never blocks the upload)
export function makePoster(file) {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    const url = window.URL.createObjectURL(file);
    const done = (b) => {
      window.URL.revokeObjectURL(url);
      resolve(b);
    };
    const timer = setTimeout(() => done(null), 8000);
    v.muted = true;
    v.preload = "metadata";
    v.playsInline = true;
    v.onerror = () => {
      clearTimeout(timer);
      done(null);
    };
    v.onloadedmetadata = () => {
      v.currentTime = Math.min(Math.max(v.duration * 0.1 || 1, 1), 30);
    };
    v.onseeked = () => {
      try {
        const w = 360;
        const h = Math.round((w * 3) / 2);
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const g = c.getContext("2d");
        g.fillStyle = "#000";
        g.fillRect(0, 0, w, h);
        const r = Math.max(w / v.videoWidth, h / v.videoHeight);
        const dw = v.videoWidth * r;
        const dh = v.videoHeight * r;
        g.drawImage(v, (w - dw) / 2, (h - dh) / 2, dw, dh);
        c.toBlob(
          (b) => {
            clearTimeout(timer);
            done(b);
          },
          "image/jpeg",
          0.8,
        );
      } catch {
        clearTimeout(timer);
        done(null);
      }
    };
    v.src = url;
  });
}
