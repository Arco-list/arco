import Link from "next/link"

export function MembershipCTA() {
  return (
    <section className="py-20 px-4 md:px-8 bg-white border-t border-[#e5e5e4]">
      <div className="max-w-[900px] mx-auto text-center">
        
        {/* Title - FIXED: Uses CSS class */}
        <h2 className="arco-page-title mb-4">
          Join the Network
        </h2>

        {/* Description - FIXED: Uses CSS class */}
        <p className="arco-body-text mb-10 max-w-[600px] mx-auto">
          Membership is by invitation or application. We review every submission to maintain the integrity of the network.
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href="/businesses/architects"
            className="btn-primary"
          >
            Apply as a Professional
          </Link>
          <Link
            href="/homeowner"
            className="btn-secondary"
          >
            I&apos;m Planning a Project
          </Link>
        </div>

      </div>
    </section>
  )
}
