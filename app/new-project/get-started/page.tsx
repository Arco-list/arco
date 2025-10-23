import Link from "next/link"

export default function GetStartedPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-gray-200">
        <div className="px-6 py-4">
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg"
            alt="Arco"
            className="h-5 w-auto"
          />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-6xl">
          <h1 className="text-5xl font-bold text-black mb-20 leading-tight">
            It's easy to get your project listed on Arco
          </h1>

          <div className="grid grid-cols-3 gap-x-16 mb-24">
            <div>
              <svg className="w-12 h-12 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h2 className="text-lg font-semibold text-black mb-2">Tell us about your project</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Share the project features, like type, style and materials and describe what makes your project unique.
              </p>
            </div>

            <div>
              <svg className="w-12 h-12 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h2 className="text-lg font-semibold text-black mb-2">Create a photo tour</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Upload photos and organize them by features of the project, like bathrooms, kitchens, and outdoor spaces. We'll help you out!
              </p>
            </div>

            <div>
              <svg className="w-12 h-12 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h2 className="text-lg font-semibold text-black mb-2">Share who helped you realise it</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                List and invite the professionals who brought your vision to life, like interior designers, contractors and suppliers.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 px-6 py-6 flex justify-end">
        <Link
          href="/new-project/details"
          className="bg-black text-white px-6 py-2.5 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          Get started
        </Link>
      </footer>
    </div>
  )
}
