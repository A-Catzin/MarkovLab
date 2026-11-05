/** Aviso de error en una página de admin cuando el backend no pudo entregar los datos. */
export function AdminError({ message }: { message: string }) {
  return (
    <p className="notice notice--error" role="alert">
      {message}
    </p>
  );
}
