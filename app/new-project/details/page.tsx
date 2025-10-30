"use client"

import { Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import { useRouter, useSearchParams } from "next/navigation"
import {
  DEFAULT_LOCATION_ICONS,
  DEFAULT_MATERIAL_ICONS,
  generateYearErrorMessages,
  getPlainTextFromHtml,
  getWordCountFromHtml,
  mapFeatureOptionsToIconItems,
  MAX_TITLE_LENGTH,
  MIN_DESCRIPTION_LENGTH,
  type ProjectDetailsDescriptionCommand,
  type ProjectDetailsFormState,
  type ProjectDetailsSelectField,
  type ProjectDetailsTextField,
  sortByOrderThenLabel,
} from "@/lib/project-details"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import type { Enums, TablesInsert, TablesUpdate } from "@/lib/supabase/types"
import { useProjectTaxonomyOptions } from "@/hooks/use-project-taxonomy-options"
import { isAdminUser } from "@/lib/auth-utils"
import { ProjectBasicsFields } from "@/components/project-details/project-basics-fields"
import { ProjectFeaturesFields } from "@/components/project-details/project-features-fields"
import { ProjectMetricsFields } from "@/components/project-details/project-metrics-fields"
import { ProjectNarrativeFields } from "@/components/project-details/project-narrative-fields"
import { SegmentedProgressBar } from "@/components/new-project/segmented-progress-bar"

type ProjectStatus = Enums<"project_status">
type ProjectBudgetLevel = Enums<"project_budget_level">

declare global {
  interface Window {
    google: any
  }
}

const DEFAULT_MAP_CENTER = {
  lat: 52.3727598,
  lng: 4.8936041,
}
const DEFAULT_MAP_ZOOM = 12

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")

const createDraftSlug = (title: string) => {
  const base = slugify(title) || "project"
  const timestamp = Date.now().toString(36)
  const randomSuffix =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14)
  return `${base}-${timestamp}${randomSuffix}`
}

const extractAddressComponents = (
  components: Array<{ long_name: string; short_name: string; types: string[] }> = [],
) => {
  let city = ""
  let region = ""
  let country = ""
  let postalCode = ""
  let street = ""
  let streetNumber = ""

  for (const component of components) {
    if (!city && (component.types.includes("locality") || component.types.includes("postal_town"))) {
      city = component.long_name
    }
    if (!region && (component.types.includes("administrative_area_level_1") || component.types.includes("administrative_area_level_2"))) {
      region = component.long_name
    }
    if (!country && component.types.includes("country")) {
      country = component.long_name
    }
    if (!postalCode && component.types.includes("postal_code")) {
      postalCode = component.long_name
    }
    if (!street && component.types.includes("route")) {
      street = component.long_name
    }
    if (!streetNumber && component.types.includes("street_number")) {
      streetNumber = component.long_name
    }
  }

  const fullStreet = [streetNumber, street].filter(Boolean).join(" ")

  return { city, region, country, postalCode, street: fullStreet }
}

const isUuid = (value?: string | null): value is string =>
  Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))

export default function NewProjectPage() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), [])
  const router = useRouter()
  const searchParams = useSearchParams()
  const [userId, setUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [isDirty, setIsDirty] = useState(false)
  const saveInFlightRef = useRef(false)
  const formDataRef = useRef<ProjectDetailsFormState | null>(null)
  const {
    categoryOptions,
    projectTypeOptionsByCategory,
    isLoadingTaxonomy,
    taxonomyError,
    projectTaxonomyError,
    projectStyleOptions,
    buildingTypeOptions,
    sizeOptions,
    budgetOptions,
    locationFeatureOptions,
    materialFeatureOptions,
  } = useProjectTaxonomyOptions(supabase)
  const stepFromUrl = searchParams.get("step")
  const initialStep = stepFromUrl ? parseInt(stepFromUrl, 10) : 1
  const [currentStep, setCurrentStep] = useState(initialStep >= 1 && initialStep <= 5 ? initialStep : 1)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [formData, setFormData] = useState<ProjectDetailsFormState>({
    category: "",
    projectType: "",
    buildingType: "",
    projectStyle: "",
    locationFeatures: [] as string[],
    materialFeatures: [] as string[],
    size: "",
    budget: "",
    yearBuilt: "",
    buildingYear: "",
    projectTitle: "",
    projectDescription: "",
    address: "",
    latitude: null,
    longitude: null,
    city: "",
    region: "",
    country: "",
    postalCode: "",
    street: "",
    shareExactLocation: false,
  })

  const prevFormDataRef = useRef(formData)
  useEffect(() => {
    formDataRef.current = formData

    if (initializing) {
      prevFormDataRef.current = formData
      return
    }

    if (prevFormDataRef.current !== formData) {
      setIsDirty(true)
      prevFormDataRef.current = formData
    }
  }, [formData, initializing])

  const [addressInputValue, setAddressInputValue] = useState("")
  const [isMapsApiLoaded, setIsMapsApiLoaded] = useState(false)
  const [mapsError, setMapsError] = useState<string | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const autocompleteRef = useRef<any>(null)
  const geocoderRef = useRef<any>(null)

  const [openDropdown, setOpenDropdown] = useState<ProjectDetailsSelectField | null>(null)
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  const projectIdFromParams = useMemo(() => searchParams.get("projectId"), [searchParams])

  useEffect(() => {
    if (!userId) {
      return
    }

    if (!projectIdFromParams) {
      setInitializing(false)
      return
    }

    let cancelled = false

    const hydrateProject = async () => {
      setInitializing(true)
      setSaveError(null)

      const { data: project, error } = await supabase
        .from("projects")
        .select(
          "id, client_id, title, description, project_type, project_type_category_id, building_type, project_size, budget_level, project_year, building_year, style_preferences, address_formatted, address_city, address_region, address_country, address_postal_code, address_street, latitude, longitude, share_exact_location, updated_at, status",
        )
        .eq("id", projectIdFromParams)
        .maybeSingle()

      if (cancelled) {
        return
      }

      if (error || !project) {
        setInitializing(false)
        if (error) {
          setSaveError(error.message)
        }
        return
      }

      if (project.client_id !== userId && !isAdmin) {
        setInitializing(false)
        setSaveError("You don't have permission to edit this project.")
        return
      }

      setProjectId(project.id)
      setLastSavedAt(project.updated_at ? new Date(project.updated_at) : new Date())

      const [
        { data: categoryRows, error: categoryError },
        { data: selectionRows, error: selectionError },
      ] = await Promise.all([
        supabase
          .from("project_categories")
          .select("category_id, is_primary")
          .eq("project_id", project.id),
        supabase
          .from("project_taxonomy_selections")
          .select("taxonomy_option_id")
          .eq("project_id", project.id),
      ])

      if ((categoryError || selectionError) && !cancelled) {
        setSaveError(categoryError?.message ?? selectionError?.message ?? null)
      }

      let locationSelections: string[] = []
      let materialSelections: string[] = []

      const taxonomyIds = (selectionRows ?? []).map((selection) => selection.taxonomy_option_id)
      if (taxonomyIds.length > 0) {
        const { data: taxonomyRows, error: taxonomyError } = await supabase
          .from("project_taxonomy_options")
          .select("id, taxonomy_type")
          .in("id", taxonomyIds)

        if (!cancelled && taxonomyRows) {
          locationSelections = taxonomyRows
            .filter((row) => row.taxonomy_type === "location_feature")
            .map((row) => row.id)
          materialSelections = taxonomyRows
            .filter((row) => row.taxonomy_type === "material_feature")
            .map((row) => row.id)
        }

        if (!cancelled && taxonomyError) {
          setSaveError(taxonomyError.message)
        }
      }

      const primaryCategoryId = categoryRows?.find((row) => row.is_primary)?.category_id ?? ""
      const parentCategoryId = categoryRows?.find((row) => !row.is_primary)?.category_id ?? ""

      const projectTypeValue = project.project_type_category_id || project.project_type || ""

      const hydratedState: ProjectDetailsFormState = {
        category: parentCategoryId || projectTypeValue,
        projectType: primaryCategoryId || projectTypeValue,
        buildingType: project.building_type ?? "",
        projectStyle: project.style_preferences?.[0] ?? "",
        locationFeatures: locationSelections,
        materialFeatures: materialSelections,
        size: project.project_size ?? "",
        budget: (project.budget_level as ProjectBudgetLevel | null) ?? "",
        yearBuilt: project.project_year ? String(project.project_year) : "",
        buildingYear: project.building_year ? String(project.building_year) : "",
        projectTitle: project.title ?? "",
        projectDescription: project.description ?? "",
        address: project.address_formatted ?? "",
        latitude: project.latitude ?? null,
        longitude: project.longitude ?? null,
        city: project.address_city ?? "",
        region: project.address_region ?? "",
        country: project.address_country ?? "",
        postalCode: project.address_postal_code ?? "",
        street: project.address_street ?? "",
        shareExactLocation: project.share_exact_location ?? false,
      }

      setFormData(hydratedState)
      setIsDirty(false)
      setInitializing(false)
    }

    hydrateProject()

    return () => {
      cancelled = true
    }
  }, [projectIdFromParams, supabase, userId, isAdmin])
  useEffect(() => {
    let cancelled = false

    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (cancelled) {
        return
      }

      if (error) {
        setSaveError(error.message)
        return
      }

      setUserId(data.user?.id ?? null)

      if (data.user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_types")
          .eq("id", data.user.id)
          .maybeSingle()
        
        setIsAdmin(isAdminUser(profile?.user_types))
      }
    }

    loadUser()

    return () => {
      cancelled = true
    }
  }, [supabase])

  const saveDraft = useCallback(
    async ({ status = "draft" as ProjectStatus }: { status?: ProjectStatus } = {}) => {
      if (saveInFlightRef.current || initializing) {
        return projectId
      }

      const snapshot = formDataRef.current
      if (!snapshot) {
        return projectId
      }

      if (!userId) {
        setSaveError("You need to be signed in to save your project.")
        return projectId
      }

      saveInFlightRef.current = true
      setIsSaving(true)
      setSaveError(null)

      const trimmedTitle = snapshot.projectTitle.trim()
      const effectiveTitle = trimmedTitle.length >= 3 ? trimmedTitle : "Untitled project"
      const { parsedYearBuilt, parsedBuildingYear } = generateYearErrorMessages(snapshot, {
        treatEmptyAsError: false,
      })

      const projectPayload: TablesInsert<"projects"> = {
        client_id: userId,
        title: effectiveTitle,
        description: snapshot.projectDescription || null,
        status,
        project_type: snapshot.projectType || null,
        project_type_category_id: isUuid(snapshot.projectType) ? snapshot.projectType : null,
        building_type: snapshot.buildingType || null,
        project_size: snapshot.size || null,
        budget_level: (snapshot.budget || null) as ProjectBudgetLevel | null,
        project_year: parsedYearBuilt,
        building_year: parsedBuildingYear,
        style_preferences: snapshot.projectStyle ? [snapshot.projectStyle] : null,
        address_formatted: snapshot.address || null,
        address_city: snapshot.city || null,
        address_region: snapshot.region || null,
        address_country: snapshot.country || null,
        address_postal_code: snapshot.postalCode || null,
        address_street: snapshot.street || null,
        latitude: snapshot.latitude,
        longitude: snapshot.longitude,
        share_exact_location: snapshot.shareExactLocation,
        location: snapshot.city || snapshot.address || null,
      }

      try {
        let nextProjectId = projectId

        if (!nextProjectId) {
          const MAX_SLUG_ATTEMPTS = 5
          let attempts = 0
          let inserted = false

          while (!inserted && attempts < MAX_SLUG_ATTEMPTS) {
            const insertPayload: TablesInsert<"projects"> = {
              ...projectPayload,
              slug: createDraftSlug(effectiveTitle),
            }

            const { data, error } = await supabase
              .from("projects")
              .insert([insertPayload])
              .select("id")
              .single()

            if (!error && data) {
              nextProjectId = data.id
              setProjectId(data.id)
              inserted = true

              // Create project_professionals entry for the owner
              // This ensures the project shows up in the listings page and pre-selects the owner in professionals step
              try {
                // Get user's email for the invite
                const { data: authData } = await supabase.auth.getUser()
                const userEmail = authData?.user?.email

                if (!userEmail) {
                  console.warn("Cannot create project_professionals: No user email found")
                } else {
                  // Get user's professional profile and company's primary service
                  const { data: professionalData, error: profError } = await supabase
                    .from("professionals")
                    .select(`
                      id,
                      company_id,
                      companies!professionals_company_id_fkey(primary_service_id)
                    `)
                    .eq("user_id", userId)
                    .maybeSingle()

                  if (profError) {
                    console.error("Error fetching professional profile:", profError)
                  } else if (!professionalData) {
                    console.warn("Cannot create project_professionals: No professional profile found for user")
                  } else {
                    // Create project_professionals entry with owner status
                    const primaryServiceId = professionalData.companies?.primary_service_id || null
                    const { error: insertError } = await supabase.from("project_professionals").insert({
                      project_id: data.id,
                      professional_id: professionalData.id,
                      company_id: professionalData.company_id,
                      invited_email: userEmail,
                      invited_service_category_id: primaryServiceId,
                      status: "listed",
                      is_project_owner: true,
                      responded_at: new Date().toISOString(),
                    })

                    if (insertError) {
                      console.error("Failed to insert project_professionals:", insertError)
                    } else {
                      console.log("Successfully created project_professionals entry for project:", data.id)
                    }
                  }
                }
              } catch (ppError) {
                // Log but don't fail the project creation if this fails
                console.error("Failed to create project_professionals entry:", ppError)
              }

              if (typeof window !== "undefined") {
                const url = new URL(window.location.href)
                url.searchParams.set("projectId", data.id)
                router.replace(`${url.pathname}?${url.searchParams.toString()}`)
              }
            } else if (error && "code" in error && error.code === "23505") {
              attempts += 1
              if (attempts >= MAX_SLUG_ATTEMPTS) {
                throw error
              }
            } else {
              throw error ?? new Error("Unable to create project draft.")
            }
          }

          if (!inserted || !nextProjectId) {
            throw new Error("Unable to create project draft after retries.")
          }
        } else {
          const { client_id: _clientId, ...rest } = projectPayload
          const projectUpdatePayload: TablesUpdate<"projects"> = rest

          const updateQuery = supabase
            .from("projects")
            .update(projectUpdatePayload)
            .eq("id", nextProjectId)

          // Only filter by client_id if not admin
          if (!isAdmin) {
            updateQuery.eq("client_id", userId)
          }

          const { error } = await updateQuery
          if (error) {
            throw error
          }
        }

        const categoryRows: { category_id: string; is_primary: boolean }[] = []
        if (snapshot.projectType && isUuid(snapshot.projectType)) {
          categoryRows.push({ category_id: snapshot.projectType, is_primary: true })
        }
        if (snapshot.category && isUuid(snapshot.category)) {
          categoryRows.push({ category_id: snapshot.category, is_primary: false })
        }

        const { error: deleteCategoriesError } = await supabase
          .from("project_categories")
          .delete()
          .eq("project_id", nextProjectId)

        if (deleteCategoriesError) {
          throw deleteCategoriesError
        }
        if (categoryRows.length) {
          const { error: insertCategoriesError } = await supabase
            .from("project_categories")
            .insert(categoryRows.map((row) => ({ ...row, project_id: nextProjectId })))

          if (insertCategoriesError) {
            throw insertCategoriesError
          }
        }

        const taxonomySelectionIds = Array.from(
          new Set(
            [
              ...snapshot.locationFeatures.filter((value) => isUuid(value)),
              ...snapshot.materialFeatures.filter((value) => isUuid(value)),
            ],
          ),
        )

        const { error: deleteSelectionsError } = await supabase
          .from("project_taxonomy_selections")
          .delete()
          .eq("project_id", nextProjectId)

        if (deleteSelectionsError) {
          throw deleteSelectionsError
        }
        if (taxonomySelectionIds.length) {
          const selectionRows = taxonomySelectionIds.map((id) => ({
            project_id: nextProjectId!,
            taxonomy_option_id: id,
          }))

          const { error: insertSelectionsError } = await supabase
            .from("project_taxonomy_selections")
            .insert(selectionRows)

          if (insertSelectionsError) {
            throw insertSelectionsError
          }
        }

        setIsDirty(false)
        setLastSavedAt(new Date())
        return nextProjectId
      } catch (error) {
        console.error("Failed to save project draft", error)
        if (error instanceof Error) {
          setSaveError(error.message)
        } else {
          setSaveError("Something went wrong while saving. Please try again.")
        }
        return null
      } finally {
        saveInFlightRef.current = false
        setIsSaving(false)
      }
    },
    [initializing, projectId, router, supabase, userId],
  )


  useEffect(() => {
    setAddressInputValue(formData.address)
  }, [formData.address])

  useEffect(() => {
    const MAX_RETRIES = 50 // 5 seconds total (50 * 100ms)
    let retryCount = 0
    let timeoutId: NodeJS.Timeout | null = null
    let cancelled = false

    const checkMapsLoaded = () => {
      if (cancelled) return // Early exit if component unmounted

      if (window.google?.maps?.marker?.AdvancedMarkerElement) {
        setIsMapsApiLoaded(true)
        setMapsError(null)
        return
      }

      retryCount++

      if (retryCount >= MAX_RETRIES) {
        setMapsError(
          "Google Maps failed to load. Please check your internet connection and refresh the page."
        )
        return
      }

      timeoutId = setTimeout(checkMapsLoaded, 100)
    }

    checkMapsLoaded()

    // Cleanup function to prevent memory leaks and setState on unmounted component
    return () => {
      cancelled = true
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [])

  useEffect(() => {
    if (initializing || !isDirty) {
      return
    }

    const timer = window.setTimeout(() => {
      void saveDraft()
    }, 30_000)

    return () => {
      window.clearTimeout(timer)
    }
  }, [initializing, isDirty, saveDraft])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) {
        return
      }

      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [isDirty])

  const lastSavedLabel = useMemo(() => {
    if (isSaving) {
      return "Saving..."
    }
    if (!lastSavedAt) {
      return "Not saved yet"
    }

    return `Saved ${lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
  }, [isSaving, lastSavedAt])

  const projectTypeOptions = useMemo(() => {
    if (!formData.category) {
      return []
    }
    const options = projectTypeOptionsByCategory[formData.category] ?? []
    return [...options].sort(sortByOrderThenLabel)
  }, [formData.category, projectTypeOptionsByCategory])

  useEffect(() => {
    if (!formData.projectType) {
      return
    }

    const isValidSelection = projectTypeOptions.some((option) => option.value === formData.projectType)
    if (!isValidSelection) {
      setFormData((prev) => ({
        ...prev,
        projectType: "",
      }))
    }
  }, [formData.projectType, projectTypeOptions])
  const sortedProjectStyleOptions = useMemo(
    () => [...projectStyleOptions].sort(sortByOrderThenLabel),
    [projectStyleOptions],
  )
  const sortedBuildingTypeOptions = useMemo(
    () => [...buildingTypeOptions].sort(sortByOrderThenLabel),
    [buildingTypeOptions],
  )
  const sortedSizeOptions = useMemo(
    () => [...sizeOptions].sort(sortByOrderThenLabel),
    [sizeOptions],
  )
  const sortedBudgetOptions = useMemo(
    () => [...budgetOptions].sort(sortByOrderThenLabel),
    [budgetOptions],
  )

  const yearFieldValidation = useMemo(
    () => generateYearErrorMessages(formData, { treatEmptyAsError: false }),
    [formData],
  )
  const isYearBuiltComplete = formData.yearBuilt.trim() !== ""
  const isBuildingYearComplete = formData.buildingYear.trim() !== ""
  const isYearBuiltValidForState = isYearBuiltComplete && !yearFieldValidation.errors.yearBuilt
  const isBuildingYearValidForState = isBuildingYearComplete && !yearFieldValidation.errors.buildingYear

  const locationFeaturesData = useMemo(
    () => mapFeatureOptionsToIconItems(locationFeatureOptions, DEFAULT_LOCATION_ICONS),
    [locationFeatureOptions],
  )

  const materialFeaturesData = useMemo(
    () => mapFeatureOptionsToIconItems(materialFeatureOptions, DEFAULT_MATERIAL_ICONS),
    [materialFeatureOptions],
  )

  const updateYearFieldErrors = (state: ProjectDetailsFormState, options?: { treatEmptyAsError?: boolean }) => {
    const { errors } = generateYearErrorMessages(state, options)

    setValidationErrors((prev) => {
      const next = { ...prev }
      delete next.yearBuilt
      delete next.buildingYear

      return Object.keys(errors).length > 0 ? { ...next, ...errors } : next
    })
  }

  const setFieldError = (field: string, message: string) => {
    setValidationErrors((prev) => {
      if (prev[field] === message) {
        return prev
      }

      return { ...prev, [field]: message }
    })
  }

  const clearFieldError = (field: string) => {
    setValidationErrors((prev) => {
      if (!prev[field]) {
        return prev
      }

      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const handleDropdownSelect = (field: ProjectDetailsSelectField, value: string) => {
    setFormData((prev) => {
      if (field === "category") {
        return {
          ...prev,
          category: value,
          projectType: "",
        }
      }

      return {
        ...prev,
        [field]: value,
      } as ProjectDetailsFormState
    })
    setOpenDropdown(null)
    clearFieldError(field)
  }

  const handleInputChange = (field: ProjectDetailsTextField, value: string) => {
    if (field === "yearBuilt" || field === "buildingYear") {
      setFormData((prev) => {
        const next = {
          ...prev,
          [field]: value,
        }

        updateYearFieldErrors(next)
        return next
      })
    } else if (field === "address") {
      setAddressInputValue(value)
      setFormData((prev) => ({
        ...prev,
        address: value,
        latitude: null,
        longitude: null,
        city: "",
        region: "",
        country: "",
        postalCode: "",
        street: "",
      }))
      clearFieldError(field)
    } else {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }))
      clearFieldError(field)
    }
  }

  useEffect(() => {
    if (currentStep !== 5 || !isMapsApiLoaded) {
      return
    }

    if (typeof window === "undefined" || !window.google || !mapContainerRef.current) {
      return
    }

    const startPosition =
      formData.latitude !== null && formData.longitude !== null
        ? { lat: formData.latitude, lng: formData.longitude }
        : DEFAULT_MAP_CENTER

    if (!mapInstanceRef.current) {
      const map = new window.google.maps.Map(mapContainerRef.current, {
        center: startPosition,
        zoom: formData.latitude !== null ? 15 : DEFAULT_MAP_ZOOM,
        mapTypeControl: true,
        fullscreenControl: false,
        streetViewControl: false,
        zoomControl: true,
        mapId: process.env.NEXT_PUBLIC_GOOGLE_MAP_ID, // Required for AdvancedMarkerElement
      })

      mapInstanceRef.current = map

      const marker = new window.google.maps.marker.AdvancedMarkerElement({
        map,
        position: startPosition,
        gmpDraggable: true,
      })

      markerRef.current = marker
      geocoderRef.current = new window.google.maps.Geocoder()

      marker.addListener("dragend", () => {
        const position = marker.position as google.maps.LatLng
        if (!position) {
          return
        }

        const lat = position.lat()
        const lng = position.lng()

        setFormData((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
        }))

        const geocoder = geocoderRef.current ?? new window.google.maps.Geocoder()
        geocoderRef.current = geocoder

        geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
          if (status === "OK" && results?.length) {
            const primary = results[0]
            const formattedAddress = primary.formatted_address ?? ""
            const { city, region, country, postalCode, street } = extractAddressComponents(primary.address_components ?? [])

            setFormData((prev) => ({
              ...prev,
              address: formattedAddress,
              latitude: lat,
              longitude: lng,
              city,
              region,
              country,
              postalCode,
              street,
            }))
            setAddressInputValue(formattedAddress)
            setValidationErrors((prev) => {
              if (!prev.address) {
                return prev
              }

              const nextErrors = { ...prev }
              delete nextErrors.address
              return nextErrors
            })
          }
        })
      })
    }

    if (!autocompleteRef.current && searchInputRef.current) {
      const autocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current, {
        fields: ["formatted_address", "geometry", "address_components"],
        types: ["geocode"],
      })

      autocompleteRef.current = autocomplete

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace()
        if (!place || !place.geometry?.location) {
          return
        }

        const location = place.geometry.location
        const lat = location.lat()
        const lng = location.lng()
        const formattedAddress = place.formatted_address ?? searchInputRef.current?.value ?? ""
        const { city, region, country, postalCode, street } = extractAddressComponents(place.address_components ?? [])

        setFormData((prev) => ({
          ...prev,
          address: formattedAddress,
          latitude: lat,
          longitude: lng,
          city,
          region,
          country,
          postalCode,
          street,
        }))
        setAddressInputValue(formattedAddress)
        setValidationErrors((prev) => {
          if (!prev.address) {
            return prev
          }

          const nextErrors = { ...prev }
          delete nextErrors.address
          return nextErrors
        })

        if (markerRef.current) {
          markerRef.current.position = { lat, lng }
        }

        if (mapInstanceRef.current) {
          if (place.geometry.viewport) {
            mapInstanceRef.current.fitBounds(place.geometry.viewport)
          } else {
            mapInstanceRef.current.panTo({ lat, lng })
            mapInstanceRef.current.setZoom(15)
          }
        }
      })
    }
  }, [currentStep, formData.latitude, formData.longitude, isMapsApiLoaded])

  useEffect(() => {
    if (currentStep !== 5) {
      if (window?.google?.maps) {
        if (markerRef.current) {
          window.google.maps.event.clearInstanceListeners(markerRef.current)
        }
        if (autocompleteRef.current) {
          window.google.maps.event.clearInstanceListeners(autocompleteRef.current)
        }
        if (mapInstanceRef.current) {
          window.google.maps.event.clearInstanceListeners(mapInstanceRef.current)
        }
      }

      markerRef.current = null
      autocompleteRef.current = null
      mapInstanceRef.current = null
    }
  }, [currentStep])

  useEffect(() => {
    if (
      currentStep !== 5 ||
      formData.latitude === null ||
      formData.longitude === null ||
      !mapInstanceRef.current ||
      !markerRef.current
    ) {
      return
    }

    const position = { lat: formData.latitude, lng: formData.longitude }
    markerRef.current.position = position
    mapInstanceRef.current.panTo(position)
  }, [currentStep, formData.latitude, formData.longitude])

  type DescriptionFormattingCommand = "bold" | "italic" | "underline" | "bulletList" | "orderedList"

  const descriptionEditor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: {
          keepAttributes: false,
          keepMarks: true,
        },
        orderedList: {
          keepAttributes: false,
          keepMarks: true,
        },
      }),
      Underline,
    ],
    content: formData.projectDescription || "",
    editorProps: {
      attributes: {
        spellCheck: "true",
      },
    },
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      const normalizedHtml = html === "<p></p>" ? "" : html

      setFormData((prev) => {
        if (prev.projectDescription === normalizedHtml) {
          return prev
        }

        return {
          ...prev,
          projectDescription: normalizedHtml,
        }
      })

      const plainTextLength = editor.getText().trim().length

      if (plainTextLength === 0) {
        setFieldError("projectDescription", "Add a project description.")
      } else if (plainTextLength < MIN_DESCRIPTION_LENGTH) {
        setFieldError(
          "projectDescription",
          `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters.`,
        )
      } else {
        clearFieldError("projectDescription")
      }
    },
  })

  useEffect(() => {
    if (!descriptionEditor) {
      return
    }

    const currentHtml = descriptionEditor.getHTML()
    const normalizedCurrent = currentHtml === "<p></p>" ? "" : currentHtml
    const desiredHtml = formData.projectDescription || ""

    if (normalizedCurrent !== desiredHtml) {
      descriptionEditor.commands.setContent(desiredHtml === "" ? "<p></p>" : desiredHtml, false)
    }
  }, [descriptionEditor, formData.projectDescription])

  const applyDescriptionFormatting = (command: DescriptionFormattingCommand) => {
    if (!descriptionEditor) {
      return
    }

    const chain = descriptionEditor.chain().focus()

    switch (command) {
      case "bold":
        chain.toggleBold()
        break
      case "italic":
        chain.toggleItalic()
        break
      case "underline":
        chain.toggleUnderline()
        break
      case "bulletList":
        chain.toggleBulletList()
        break
      case "orderedList":
        chain.toggleOrderedList()
        break
      default:
        break
    }

    chain.run()
  }

  const handleCheckboxChange = (field: "locationFeatures" | "materialFeatures", value: string) => {
    const currentValues = formData[field]
    const newValues = currentValues.includes(value)
      ? currentValues.filter((v) => v !== value)
      : [...currentValues, value]

    setFormData({ ...formData, [field]: newValues })
    if (newValues.length > 0) {
      clearFieldError(field)
    }
  }

  const validateStep = (step: number) => {
    const stepFields: string[] = []
    const newErrors: Record<string, string> = {}

    if (step === 1) {
      stepFields.push("category", "projectType", "buildingType", "projectStyle")

      if (!formData.category) {
        newErrors.category = "Select a project category."
      }
      if (!formData.projectType) {
        newErrors.projectType = "Select a project type."
      }
      if (!formData.buildingType) {
        newErrors.buildingType = "Select a building type."
      }
      if (!formData.projectStyle) {
        newErrors.projectStyle = "Select a project style."
      }
    } else if (step === 2) {
      stepFields.push("locationFeatures", "materialFeatures")

      if (formData.locationFeatures.length === 0) {
        newErrors.locationFeatures = "Select at least one location feature."
      }
      if (formData.materialFeatures.length === 0) {
        newErrors.materialFeatures = "Select at least one material feature."
      }
    } else if (step === 3) {
      stepFields.push("size", "budget", "yearBuilt", "buildingYear")

      if (!formData.size) {
        newErrors.size = "Select a size range."
      }
      if (!formData.budget) {
        newErrors.budget = "Select a budget tier."
      }

      const yearErrors = generateYearErrorMessages(formData, { treatEmptyAsError: true }).errors

      if (yearErrors.yearBuilt) {
        newErrors.yearBuilt = yearErrors.yearBuilt
      }
      if (yearErrors.buildingYear) {
        newErrors.buildingYear = yearErrors.buildingYear
      }
    } else if (step === 4) {
      stepFields.push("projectTitle", "projectDescription")

      const trimmedTitle = formData.projectTitle.trim()
      if (!trimmedTitle) {
        newErrors.projectTitle = "Add a project title."
      } else if (trimmedTitle.length > MAX_TITLE_LENGTH) {
        newErrors.projectTitle = `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`
      }

      const descriptionPlain = getPlainTextFromHtml(formData.projectDescription).trim()
      if (!descriptionPlain) {
        newErrors.projectDescription = "Add a project description."
      } else if (descriptionPlain.length < MIN_DESCRIPTION_LENGTH) {
        newErrors.projectDescription = `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters.`
      }
    } else if (step === 5) {
      stepFields.push("address")
      if (!formData.address.trim()) {
        newErrors.address = "Enter the project address."
      } else if (formData.latitude === null || formData.longitude === null) {
        newErrors.address = "Select a valid address from the suggestions or map."
      }
    }

    setValidationErrors((prev) => {
      const next = { ...prev }
      stepFields.forEach((field) => {
        if (!newErrors[field]) {
          delete next[field]
        }
      })

      return Object.keys(newErrors).length > 0 ? { ...next, ...newErrors } : next
    })

    return Object.keys(newErrors).length === 0
  }

  const trimmedTitle = formData.projectTitle.trim()
  const descriptionPlainText = getPlainTextFromHtml(formData.projectDescription)
  const descriptionPlainTextLength = descriptionPlainText.trim().length
  const descriptionWordCount = getWordCountFromHtml(formData.projectDescription)

  const isNextDisabled =
    (currentStep === 1 &&
      (!formData.category || !formData.projectType || !formData.buildingType || !formData.projectStyle)) ||
    (currentStep === 2 &&
      (formData.locationFeatures.length === 0 || formData.materialFeatures.length === 0)) ||
    (currentStep === 3 &&
      (!formData.size ||
        !formData.budget ||
        !isYearBuiltValidForState ||
        !isBuildingYearValidForState)) ||
    (currentStep === 4 &&
      (!trimmedTitle ||
        trimmedTitle.length > MAX_TITLE_LENGTH ||
        descriptionPlainTextLength === 0 ||
        descriptionPlainTextLength < MIN_DESCRIPTION_LENGTH)) ||
    (currentStep === 5 &&
      (!formData.address.trim() || formData.latitude === null || formData.longitude === null))

  const handleNext = async () => {
    if (isSaving) {
      return
    }

    if (!validateStep(currentStep)) {
      return
    }

    const savedProjectId = await saveDraft()

    if (currentStep < 5) {
      if (savedProjectId || projectId) {
        setCurrentStep((prev) => Math.min(prev + 1, 5))
      }
      return
    }

    if (savedProjectId) {
      router.push(`/new-project/photos?projectId=${savedProjectId}`)
    } else {
      setSaveError("We couldn't save your progress. Please try again before continuing.")
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      void saveDraft()
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSaveAndExit = async () => {
    if (isSaving) {
      return
    }

    const savedProjectId = await saveDraft({ status: "draft" })
    if (!savedProjectId) {
      return
    }

    router.push("/dashboard/listings")
  }

  const handleToggleChange = (value: boolean) => {
    setFormData((prev) => ({
      ...prev,
      shareExactLocation: value,
    }))
  }

  return (
    <div className="min-h-screen bg-white">
      <NewProjectHeader isSaving={isSaving} onSaveAndExit={() => void handleSaveAndExit()} />
      <main className="container mx-auto px-4 py-16 max-w-4xl pb-32">
        <div className="text-left">
          {saveError && (
            <div className="mb-8 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {saveError}
            </div>
          )}
          <div className="mb-12">
            <SegmentedProgressBar currentGlobalStep={currentStep} />
          </div>

          {currentStep === 1 && (
            <>
              {/* Building icon */}
              <div className="mb-8">
                <Building2 className="w-12 h-12 text-gray-900" strokeWidth={1.5} />
              </div>

              {/* Main heading */}
              <h1 className="text-3xl font-bold text-gray-900 mb-6 leading-tight">What project have you realised?</h1>

              <ProjectBasicsFields
                formData={formData}
                validationErrors={validationErrors}
                categoryOptions={categoryOptions}
                projectTypeOptions={projectTypeOptions}
                buildingTypeOptions={sortedBuildingTypeOptions}
                projectStyleOptions={sortedProjectStyleOptions}
                openDropdown={openDropdown}
                setOpenDropdown={setOpenDropdown}
                onDropdownSelect={handleDropdownSelect}
                isLoadingTaxonomy={isLoadingTaxonomy}
                taxonomyError={taxonomyError}
                projectTaxonomyError={projectTaxonomyError}
              />
            </>
          )}

          {currentStep === 2 && (
            <>
              {/* Main heading */}
              <h1 className="text-3xl font-bold text-gray-900 mb-12 leading-tight">
                Describe the location and materials used
              </h1>

              <ProjectFeaturesFields
                locationItems={locationFeaturesData}
                materialItems={materialFeaturesData}
                selectedLocationFeatures={formData.locationFeatures}
                selectedMaterialFeatures={formData.materialFeatures}
                onToggle={handleCheckboxChange}
                validationErrors={validationErrors}
                projectTaxonomyError={projectTaxonomyError}
              />
            </>
          )}

          {currentStep === 3 && (
            <>
              {/* Main heading */}
              <h1 className="text-3xl font-bold text-gray-900 mb-12 leading-tight">Add some details</h1>

              <ProjectMetricsFields
                formData={formData}
                validationErrors={validationErrors}
                sizeOptions={sortedSizeOptions}
                budgetOptions={sortedBudgetOptions}
                openDropdown={openDropdown}
                setOpenDropdown={setOpenDropdown}
                onDropdownSelect={handleDropdownSelect}
                onInputChange={handleInputChange}
              />
            </>
          )}

          {currentStep === 4 && (
            <>
              {/* Main heading */}
              <h1 className="text-3xl font-bold text-gray-900 mb-12 leading-tight">
                Give your project a title and description
              </h1>

              <ProjectNarrativeFields
                formData={formData}
                validationErrors={validationErrors}
                onInputChange={handleInputChange}
                editor={descriptionEditor}
                onCommand={applyDescriptionFormatting}
                plainTextLength={descriptionPlainTextLength}
                wordCount={descriptionWordCount}
                minDescriptionLength={MIN_DESCRIPTION_LENGTH}
                maxTitleLength={MAX_TITLE_LENGTH}
              />
            </>
          )}

          {currentStep === 5 && (
            <>
              {/* Main heading */}
              <h1 className="text-3xl font-bold text-gray-900 mb-12 leading-tight">Where is the project located?</h1>

              {/* Form */}
              <div className="space-y-8">
                {/* Map Container */}
                <div className="relative">
                  {googleMapsApiKey ? (
                    <>
                      <div className="relative w-full h-96 bg-gray-100 rounded-lg overflow-hidden">
                        <div ref={mapContainerRef} className="h-full w-full" />
                        <div className="pointer-events-none absolute top-4 left-0 right-0 z-10 flex justify-center px-4">
                          <input
                            ref={searchInputRef}
                            type="text"
                            value={addressInputValue}
                            onChange={(event) => handleInputChange("address", event.target.value)}
                            placeholder="Search for your address"
                            className="pointer-events-auto w-full max-w-xl px-4 py-3 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent hover:border-gray-400 transition-colors"
                          />
                        </div>
                        {!isMapsApiLoaded && !mapsError && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white/60 text-gray-700">
                            Loading map...
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                      Add your Google Maps API key to `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to enable address
                      autocomplete and map selection.
                    </div>
                  )}
                  <p className="text-sm text-gray-500 mt-2">
                    Search for your project location or drag the pin on the map to fine-tune it
                  </p>
                  {mapsError && <p className="text-sm text-red-600 mt-2">{mapsError}</p>}
                  {validationErrors.address && (
                    <p className="text-sm text-red-600 mt-2">{validationErrors.address}</p>
                  )}
                  <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm font-medium text-gray-900">Selected address</p>
                    <p className="mt-1 text-sm text-gray-700">
                      {formData.address
                        ? formData.address
                        : "Start typing in the search box or drag the map pin to capture the address."}
                    </p>
                  </div>
                </div>

                {/* Share exact location toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h3 className="text-base font-medium text-gray-900 mb-1">
                      Share the exact location of the project
                    </h3>
                    <p className="text-sm text-gray-500">Allow others to see the precise location of your project</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleChange(!formData.shareExactLocation)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 ${
                      formData.shareExactLocation ? "bg-gray-900" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.shareExactLocation ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
        <div className="container mx-auto max-w-4xl">
      <div className="flex gap-4 justify-center">
        <Button
          onClick={handleBack}
          variant="tertiary"
          size="tertiary"
        >
          Back
        </Button>
        <Button
          onClick={() => void handleNext()}
          disabled={isNextDisabled || isSaving}
          variant="secondary"
          size="lg"
        >
          {isSaving ? "Saving..." : currentStep === 5 ? "Complete" : "Next"}
        </Button>
          </div>
        </div>
      </div>
    </div>
  )
}


function NewProjectHeader({
  isSaving,
  onSaveAndExit,
}: {
  isSaving: boolean
  onSaveAndExit: () => void
}) {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo on the left */}
          <div className="flex-shrink-0">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg"
              alt="Arco"
              className="h-4 w-auto"
            />
          </div>

          {/* Right side navigation */}
          <div className="flex items-center space-x-6">
            {/* Questions link */}
            <a
              href="/help-center"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-black hover:text-gray-600 transition-colors"
            >
              Questions?
            </a>

            <Button
              onClick={onSaveAndExit}
              disabled={isSaving}
              variant="tertiary"
              size="tertiary"
              aria-busy={isSaving}
            >
              {isSaving ? "Saving..." : "Save and Exit"}
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
