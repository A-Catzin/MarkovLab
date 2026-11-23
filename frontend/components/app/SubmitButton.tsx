"use client";

import { useFormStatus } from "react-dom";

/**
 * Botón de envío para formularios Server Action que refleja el estado pendiente con `aria-busy`
 * y deshabilita envíos duplicados mientras el servidor procesa la operación.
 */
export function SubmitButton({
  pendingLabel,
  className = "button button--small",
  "aria-label": ariaLabel,
  children,
}: {
  pendingLabel: string;
  className?: string;
  "aria-label"?: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      aria-busy={pending}
      aria-label={ariaLabel}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
