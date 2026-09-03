import Image from "next/image";

/** Logo Yanti (isotipo color + wordmark), enlazado a inicio. aria-label accesible. */
export function Logo({ href = "/", size = 28 }: { href?: string; size?: number }) {
  return (
    <a href={href} className="logo-link" aria-label="Yanti — inicio">
      <Image
        src="/brand/yanti-isotype-color.svg"
        alt=""
        width={size}
        height={size}
        className="logo-mark"
        priority
      />
      <span aria-hidden="true">Yanti</span>
    </a>
  );
}
