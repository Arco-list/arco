import Image from "next/image"
import { HeroPhotosButton } from "./hero-photos-button"
import { PhotoBrandDots } from "./photo-brand-dots"
import type { PhotoBrandTag } from "@/lib/projects/photo-brand-tags"
import { focusPosition, type Focus } from "@/lib/images/focus"

interface ProjectHeroProps {
  imageUrl: string | null
  alt: string
  /** Photos available in the tour below — >0 renders the "view
   *  photos" pill that opens the lightbox. */
  photoCount?: number
  /** Merk-stippen op de omslagfoto (migratie 317). */
  brandTags?: PhotoBrandTag[]
  imageWidth?: number | null
  imageHeight?: number | null
  /** Focuspunt (migratie 328): waar de hero omheen bijsnijdt. */
  focus?: Focus | null
}

export function ProjectHero({ imageUrl, alt, photoCount = 0, brandTags = [], imageWidth, imageHeight, focus }: ProjectHeroProps) {
  return (
    <section className="hero-max-width project-hero-frame relative w-full overflow-hidden bg-black">
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={alt}
          fill
          className="object-cover"
          style={{ objectPosition: focusPosition(focus) }}
          priority
          sizes="100vw"
          quality={90}
        />
      ) : (
        <div className="w-full h-full bg-surface" />
      )}
      {imageUrl && brandTags.length > 0 && (
        <PhotoBrandDots tags={brandTags} src={imageUrl} width={imageWidth} height={imageHeight} fit="cover" focus={focus} />
      )}
      {imageUrl && photoCount > 0 && <HeroPhotosButton />}
    </section>
  )
}
