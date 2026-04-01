"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import type { PreloadedCompany } from "@/app/businesses/actions"

type CreateCompanyModalContextValue = {
  isOpen: boolean
  initialCompany: PreloadedCompany | undefined
  openCreateCompanyModal: (preloaded?: PreloadedCompany) => void
  closeCreateCompanyModal: () => void
}

const CreateCompanyModalContext = createContext<CreateCompanyModalContextValue | undefined>(undefined)

export function CreateCompanyModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [initialCompany, setInitialCompany] = useState<PreloadedCompany | undefined>(undefined)

  const openCreateCompanyModal = useCallback((preloaded?: PreloadedCompany) => {
    setInitialCompany(preloaded)
    setIsOpen(true)
  }, [])

  const closeCreateCompanyModal = useCallback(() => {
    setIsOpen(false)
    setInitialCompany(undefined)
  }, [])

  const value = useMemo(
    () => ({ isOpen, initialCompany, openCreateCompanyModal, closeCreateCompanyModal }),
    [isOpen, initialCompany, openCreateCompanyModal, closeCreateCompanyModal],
  )

  return (
    <CreateCompanyModalContext.Provider value={value}>
      {children}
    </CreateCompanyModalContext.Provider>
  )
}

export function useCreateCompanyModal() {
  const context = useContext(CreateCompanyModalContext)
  if (!context) {
    throw new Error("useCreateCompanyModal must be used within a CreateCompanyModalProvider")
  }
  return context
}
