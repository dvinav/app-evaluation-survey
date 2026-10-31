import Image from 'next/image'
export function ApplicationIcon({ icon }: { icon: string }) {
  return icon ? (
    <Image
      src={icon}
      alt=""
      width={48}
      height={48}
      unoptimized
      className="application-icon"
    />
  ) : (
    <span className="application-icon icon-fallback" aria-hidden="true" />
  )
}
