import Image from "next/image";

export default function Avatar({ src, size, alt }) {
  if (src) {
    return (
      <Image
        className="rounded-full not-prose inline-block border border-zinc-300"
        src={`${process.env.NEXT_PUBLIC_PROXY_URL}${src.replace("https://", "")}`}
        width={size}
        height={size}
        alt={alt}
      />
    );
  } else
    return (
      <span className="inline-block w-5 h-5 px-2 rounded-full leading-normal text-zinc-300 dark:text-black bg-black dark:bg-zinc-300"></span>
    );
}
