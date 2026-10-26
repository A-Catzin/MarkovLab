import Link from "next/link";

/** Logotipo de texto de MarkovLab; "Lab" va en el color de acento. */
export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link className="wordmark" href={href}>
      Markov<span className="wordmark__accent">Lab</span>
    </Link>
  );
}
