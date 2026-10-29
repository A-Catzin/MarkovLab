import Link from "next/link";
import { LogoMark } from "./LogoMark";

/** Logotipo de MarkovLab: el símbolo y el nombre, con "Lab" en el color de acento. */
export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link className="wordmark" href={href}>
      <LogoMark className="wordmark__mark" />
      <span>
        Markov<span className="wordmark__accent">Lab</span>
      </span>
    </Link>
  );
}
