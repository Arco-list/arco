"use client"

import { useState, type ImgHTMLAttributes } from "react"

type SmartImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "ref"> & {
  src: string
}

// Fills the container for landscape images (crop) and fits-by-height for
// portrait images (blank space left/right). Detected from naturalWidth vs.
// naturalHeight on load — falls back to `cover` until the image loads so
// landscape covers stay seamless.
export function SmartImage({ src, style, onLoad, ...rest }: SmartImageProps) {
  const [fit, setFit] = useState<"cover" | "contain">("cover")

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...rest}
      src={src}
      onLoad={(e) => {
        const img = e.currentTarget
        setFit(img.naturalWidth >= img.naturalHeight ? "cover" : "contain")
        onLoad?.(e)
      }}
      style={{ width: "100%", height: "100%", objectFit: fit, display: "block", ...style }}
    />
  )
}
