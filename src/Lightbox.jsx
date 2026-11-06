import "./posts.css";
import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

// items: [{ url, caption }]   index: which one is open
export default function Lightbox({ items, index, onIndex, onClose }) {
  const item = items[index];
  const many = items.length > 1;
  const dialogRef = useRef(null);
  const closeButton = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const step = (d) => onIndex((index + d + items.length) % items.length);
  const stepRef = useRef(step);
  stepRef.current = step;
  const manyRef = useRef(many);
  manyRef.current = many;

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    function key(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      } else if (manyRef.current && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        stepRef.current(e.key === "ArrowLeft" ? -1 : 1);
      }
      else if (e.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  if (!item) return null;
  return (
    <div ref={dialogRef} className="lb" role="dialog" aria-modal="true" aria-label={item.caption || "Photo viewer"} tabIndex={-1} onClick={onClose}>
      <button type="button" ref={closeButton} className="lb-btn lb-close" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Close photo viewer">
        <X size={22} />
      </button>
      {many && (
        <button type="button"
          className="lb-btn lb-prev"
          onClick={(e) => {
            e.stopPropagation();
            step(-1);
          }}
          aria-label="Previous photo"
        >
          <ChevronLeft size={26} />
        </button>
      )}
      <figure onClick={(e) => e.stopPropagation()}>
        <img src={item.url} alt={item.caption || "Photo"} />
        {(item.caption || many) && (
          <figcaption>
            {item.caption}
            {many && (
              <span>
                {" "}
                · {index + 1} / {items.length}
              </span>
            )}
          </figcaption>
        )}
      </figure>
      {many && (
        <button type="button"
          className="lb-btn lb-next"
          onClick={(e) => {
            e.stopPropagation();
            step(1);
          }}
          aria-label="Next photo"
        >
          <ChevronRight size={26} />
        </button>
      )}
    </div>
  );
}
