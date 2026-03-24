"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

type CreateCompanyModalContextValue = {
  isOpen: boolean
  openCreateCompanyModal: () => void
  closeCreateCompanyModal: () => void
}

const CreateCompanyModalContext = createContext<CreateCompanyModalContextValue | undefined>(undefined)

export function CreateCompanyModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const openCreateCompanyModal = useCallback(() => {
    setIsOpen(true)
  }, [])

  const closeCreateCompanyModal = useCallback(() => {
    setIsOpen(false)
  }, [])

  const value = useMemo(
    () => ({ isOpen, openCreateCompanyModal, closeCreateCompanyModal }),
    [isOpen, openCreateCompanyModal, closeCreateCompanyModal],
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
