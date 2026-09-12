import Image from "next/image"
import { HeroPhotosButton } from "./hero-photos-button"

interface ProjectHeroProps {
  imageUrl: string | null
  alt: string
  /** Photos available in the tour below — >0 renders the "view
   *  photos" pill that opens the lightbox. */
  photoCount?: number
}

export function ProjectHero({ imageUrl, alt, photoCount = 0 }: ProjectHeroProps) {
  return (
    <section
      className="relative w-full h-[600px] md:h-[700px] lg:h-[82vh] overflow-hidden bg-black"
      style={{ minHeight: '560px' }}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={alt}
          fill
          className="object-cover"
          priority
          sizes="100vw"
          quality={90}
        />
      ) : (
        <div className="w-full h-full bg-surface" />
      )}
      {imageUrl && photoCount > 0 && <HeroPhotosButton />}
    </section>
  )
}
