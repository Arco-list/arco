import Image from "next/image"

interface ProjectHeroProps {
  imageUrl: string | null
  alt: string
}

export function ProjectHero({ imageUrl, alt }: ProjectHeroProps) {
  return (
    <section className="project-hero">
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={alt}
          fill
          className="hero-image"
          priority
          sizes="100vw"
        />
      ) : (
        <div className="w-full h-full bg-surface" />
      )}
    </section>
  )
}
