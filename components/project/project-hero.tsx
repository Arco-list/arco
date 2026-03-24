import Image from "next/image"

interface ProjectHeroProps {
  imageUrl: string | null
  alt: string
}

export function ProjectHero({ imageUrl, alt }: ProjectHeroProps) {
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
    </section>
  )
}
