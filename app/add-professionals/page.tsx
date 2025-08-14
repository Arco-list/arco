"use client"

import { useState } from "react"

export default function AddProfessionalsPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 4 // Updated total steps to 4 to include final publish step
  const [selectedProfessionals, setSelectedProfessionals] = useState<string[]>([])
  const [invitedProfessionals, setInvitedProfessionals] = useState<{
    [key: string]: { name?: string; email?: string; status: "pending" | "invited" }
  }>({})
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [currentInviteProfessional, setCurrentInviteProfessional] = useState<string>("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [openMenus, setOpenMenus] = useState<{ [key: string]: boolean }>({})

  const professionalServices = [
    {
      id: "architect",
      name: "Architect",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      ),
    },
    {
      id: "interior-designer",
      name: "Interior Designer",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4 4 4 0 004-4V5z"
          />
        </svg>
      ),
    },
    {
      id: "general-contractor",
      name: "General contractor",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      id: "structural-engineer",
      name: "Structural Engineer",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
          />
        </svg>
      ),
    },
    {
      id: "landscape-architect",
      name: "Landscape Architect",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
          />
        </svg>
      ),
    },
    {
      id: "electrician",
      name: "Electrician",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      id: "plumber",
      name: "Plumber",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
          />
        </svg>
      ),
    },
    {
      id: "hvac-specialist",
      name: "HVAC Specialist",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ),
    },
    {
      id: "roofer",
      name: "Roofer",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
    },
    {
      id: "flooring-specialist",
      name: "Flooring Specialist",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
          />
        </svg>
      ),
    },
    {
      id: "painter",
      name: "Painter",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
      ),
    },
    {
      id: "mason",
      name: "Mason",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      ),
    },
  ]

  const toggleProfessional = (professionalId: string) => {
    setSelectedProfessionals((prev) =>
      prev.includes(professionalId) ? prev.filter((id) => id !== professionalId) : [...prev, professionalId],
    )
  }

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    } else {
      // Handle publish action
      console.log("Publishing project...")
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleInviteProfessional = (professionalId: string) => {
    setCurrentInviteProfessional(professionalId)
    setInviteEmail("")
    setShowInviteModal(true)
  }

  const handleSendInvite = () => {
    if (inviteEmail.trim()) {
      setInvitedProfessionals((prev) => ({
        ...prev,
        [currentInviteProfessional]: {
          email: inviteEmail,
          status: "invited",
        },
      }))
      setShowInviteModal(false)
      setInviteEmail("")
    }
  }

  const toggleMenu = (professionalId: string) => {
    setOpenMenus((prev) => ({
      ...prev,
      [professionalId]: !prev[professionalId],
    }))
  }

  const deleteProfessional = (professionalId: string) => {
    setSelectedProfessionals((prev) => prev.filter((id) => id !== professionalId))
    setInvitedProfessionals((prev) => {
      const updated = { ...prev }
      delete updated[professionalId]
      return updated
    })
    setOpenMenus((prev) => ({
      ...prev,
      [professionalId]: false,
    }))
  }

  const cancelInvitation = (professionalId: string) => {
    setInvitedProfessionals((prev) => {
      const updated = { ...prev }
      delete updated[professionalId]
      return updated
    })
    setOpenMenus((prev) => ({
      ...prev,
      [professionalId]: false,
    }))
  }

  const canProceed =
    currentStep === 1 ||
    (currentStep === 2 && selectedProfessionals.length > 0) ||
    currentStep === 3 ||
    currentStep === 4

  return (
    <div className="min-h-screen bg-white">
      <AddProfessionalsHeader />

      {/* Progress indicator */}
      <div className="container mx-auto px-4 py-4 max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Step {currentStep} of {totalSteps}
            </span>
            <span className="text-sm text-gray-500">{Math.round((currentStep / totalSteps) * 100)}% complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gray-900 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 max-w-4xl pb-32">
        {currentStep === 1 && (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-left max-w-2xl">
              {/* Professional icon */}
              <div className="mb-8">
                <svg className="w-16 h-16 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0z"
                  />
                </svg>
              </div>

              <h1 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">Share who helped you realise it</h1>
              <p className="text-gray-600 text-lg leading-relaxed">Share professionals that worked on the project</p>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">
                Tell us what professionals helped you realise it
              </h1>
              <p className="text-gray-600 text-lg leading-relaxed">
                You can add more features after you published your project
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {professionalServices.map((professional) => (
                <button
                  key={professional.id}
                  onClick={() => toggleProfessional(professional.id)}
                  className={`p-6 rounded-lg border-2 text-left transition-all duration-200 hover:shadow-md ${
                    selectedProfessionals.includes(professional.id)
                      ? "border-gray-900 bg-gray-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="text-gray-900">{professional.icon}</div>
                    <span className="font-medium text-gray-900">{professional.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">Invite professionals</h1>
                <p className="text-gray-600 text-lg leading-relaxed">
                  We'll email them to invite when you published the project
                </p>
              </div>
              <button className="w-10 h-10 bg-gray-900 text-white rounded-full flex items-center justify-center hover:bg-gray-800 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedProfessionals.map((professionalId) => {
                const professional = professionalServices.find((p) => p.id === professionalId)
                const invitation = invitedProfessionals[professionalId]

                return (
                  <div key={professionalId} className="p-6 rounded-lg border border-gray-200 bg-white relative">
                    <div className="absolute top-4 right-4">
                      <button
                        onClick={() => toggleMenu(professionalId)}
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
                      >
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                        </svg>
                      </button>

                      {openMenus[professionalId] && (
                        <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-md shadow-lg z-10 min-w-[160px]">
                          {invitation?.status === "invited" ? (
                            <button
                              onClick={() => cancelInvitation(professionalId)}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              Cancel invite
                            </button>
                          ) : null}
                          <button
                            onClick={() => deleteProfessional(professionalId)}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            Delete professional
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-3 mb-4">
                      <div className="text-gray-900">{professional?.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{professional?.name}</span>
                          {invitation?.status === "invited" && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                              Invited
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {invitation?.status === "invited" ? (
                      <div className="space-y-2">
                        <div className="text-sm text-orange-600 font-medium">Will be invited</div>
                        <div className="text-sm text-gray-600">{invitation.email}</div>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleInviteProfessional(professionalId)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                      >
                        Invite professional
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-left max-w-2xl">
              <h1 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">Yeah! It's time to publish</h1>
              <p className="text-gray-600 text-lg leading-relaxed mb-8">This is what homeowners will see</p>

              <div className="relative">
                <div className="rounded-lg overflow-hidden shadow-lg">
                  <img
                    src="/placeholder.svg?height=320&width=600"
                    alt="Project preview"
                    className="w-full h-80 object-cover"
                  />
                  <div className="absolute top-4 left-4">
                    <button className="px-4 py-2 bg-white text-gray-900 rounded-md font-medium shadow-sm hover:bg-gray-50 transition-colors">
                      Show preview
                    </button>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-gray-900 font-medium">Project name</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Invite Professional</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email address
                </label>
                <input
                  type="email"
                  id="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendInvite}
                  disabled={!inviteEmail.trim()}
                  className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sticky bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
        <div className="container mx-auto max-w-4xl">
          <div className="flex gap-4">
            <button
              onClick={handleBack}
              disabled={currentStep === 1}
              className="flex-1 bg-white text-gray-900 py-3 px-6 rounded-md text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>
            <button
              onClick={handleNext}
              disabled={!canProceed}
              className="flex-1 bg-gray-900 text-white py-3 px-6 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {currentStep === totalSteps ? "Publish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AddProfessionalsHeader() {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex-shrink-0">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg"
              alt="Arco"
              className="h-6"
            />
          </div>

          <div className="flex items-center space-x-4">
            <a
              href="/help-center"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 hover:text-gray-900 font-medium transition-colors"
            >
              Questions?
            </a>

            <button className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium transition-colors">
              Save and Exit
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
