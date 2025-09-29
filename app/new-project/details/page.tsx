"use client"

import {
  Building2,
  ChevronDown,
  Mountain,
  Trees,
  Waves,
  Eye,
  Building,
  GuitarIcon as Golf,
  Snowflake,
  BeanIcon as Beach,
  Anchor,
  TreePine,
  Zap,
  BrickWallIcon as Brick,
  Square,
  Layers,
  BananaIcon as Bamboo,
  BoneIcon as Stone,
  Home,
  CloudRainIcon as Roof,
} from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { csvData, projectStyles, locationFeatures } from "@/lib/csv-data"

export default function NewProjectPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
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
    shareExactLocation: false,
  })

  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const router = useRouter()

  const dropdownOptions = {
    category: [
      { value: "residential", label: "Residential" },
      { value: "commercial", label: "Commercial" },
      { value: "industrial", label: "Industrial" },
      { value: "institutional", label: "Institutional" },
      { value: "mixed-use", label: "Mixed Use" },
    ],
    projectType: csvData.listingTypes.map((type) => ({
      value: type.toLowerCase().replace(/\s+/g, "-"),
      label: type,
    })),
    buildingType: csvData.listingTypes.map((type) => ({
      value: type.toLowerCase().replace(/\s+/g, "-"),
      label: type,
    })),
    projectStyle: projectStyles.map((style) => ({
      value: style.toLowerCase().replace(/\s+/g, "-"),
      label: style,
    })),
    size: [
      { value: "compact", label: "Compact" },
      { value: "medium", label: "Medium" },
      { value: "large", label: "Large" },
      { value: "expansive", label: "Expansive" },
      { value: "estate", label: "Estate" },
    ],
    budget: [
      { value: "$", label: "$" },
      { value: "$$", label: "$$" },
      { value: "$$$", label: "$$$" },
      { value: "$$$$", label: "$$$$" },
      { value: "$$$$$", label: "$$$$$" },
    ],
  }

  const locationFeaturesData = locationFeatures.map((feature, index) => ({
    value: feature.toLowerCase().replace(/\s+/g, "-"),
    label: feature,
    icon: [Waves, Eye, Building, Trees, Golf, Snowflake, Waves, Beach, Anchor, TreePine, Mountain][index % 11],
  }))

  const materialFeaturesData = csvData.features.map((feature, index) => ({
    value: feature.toLowerCase().replace(/\s+/g, "-"),
    label: feature,
    icon: [Zap, Square, Square, Roof, Bamboo, Stone, Brick, Layers, Home, Square][index % 10],
  }))

  const handleDropdownSelect = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })
    setOpenDropdown(null)
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })
  }

  const handleCheckboxChange = (field: "locationFeatures" | "materialFeatures", value: string) => {
    const currentValues = formData[field]
    const newValues = currentValues.includes(value)
      ? currentValues.filter((v) => v !== value)
      : [...currentValues, value]

    setFormData({ ...formData, [field]: newValues })
  }

  const handleNext = () => {
    if (currentStep === 1) {
      const isFormValid = formData.category && formData.projectType && formData.buildingType && formData.projectStyle
      if (isFormValid) {
        setCurrentStep(2)
      } else {
        alert("Please fill in all required fields before proceeding.")
      }
    } else if (currentStep === 2) {
      const isFormValid = formData.locationFeatures.length > 0 && formData.materialFeatures.length > 0
      if (isFormValid) {
        setCurrentStep(3)
      } else {
        alert("Please select at least one location feature and one material feature.")
      }
    } else if (currentStep === 3) {
      const isFormValid = formData.size && formData.budget && formData.yearBuilt && formData.buildingYear
      if (isFormValid) {
        setCurrentStep(4)
      } else {
        alert("Please fill in all required fields before proceeding.")
      }
    } else if (currentStep === 4) {
      const isFormValid = formData.projectTitle && formData.projectDescription
      if (isFormValid) {
        setCurrentStep(5)
      } else {
        alert("Please fill in all required fields before proceeding.")
      }
    } else if (currentStep === 5) {
      const isFormValid = formData.address
      if (isFormValid) {
        console.log("Form submitted with data:", formData)
        router.push("/photo-tour")
      } else {
        alert("Please enter the project address before proceeding.")
      }
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const CustomDropdown = ({
    field,
    placeholder,
    value,
    options,
  }: {
    field: string
    placeholder: string
    value: string
    options: { value: string; label: string }[]
  }) => {
    const isOpen = openDropdown === field
    const selectedOption = options.find((opt) => opt.value === value)

    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenDropdown(isOpen ? null : field)}
          className="w-full px-4 py-3 border border-gray-300 rounded-md bg-white text-left text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent hover:border-gray-400 transition-colors"
        >
          <span className={selectedOption ? "text-gray-900" : "text-gray-500"}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown
            className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleDropdownSelect(field, option.value)}
                className="w-full px-4 py-3 text-left text-gray-900 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  const CheckboxGrid = ({
    title,
    items,
    selectedValues,
    onChange,
  }: {
    title: string
    items: { value: string; label: string; icon: any }[]
    selectedValues: string[]
    onChange: (value: string) => void
  }) => (
    <div>
      <label className="block text-base font-medium text-gray-900 mb-4">
        {title} <span className="text-red-500">*</span>
      </label>
      <div className="grid grid-cols-2 gap-4">
        {items.map((item) => {
          const IconComponent = item.icon
          const isSelected = selectedValues.includes(item.value)

          return (
            <label
              key={item.value}
              className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded-md transition-colors"
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onChange(item.value)}
                className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
              />
              <IconComponent className="w-5 h-5 text-gray-600" />
              <span className="text-gray-900">{item.label}</span>
            </label>
          )
        })}
      </div>
    </div>
  )

  const handleToggleChange = (field: string, value: boolean) => {
    setFormData({ ...formData, [field]: value })
  }

  return (
    <div className="min-h-screen bg-white">
      <NewProjectHeader />
      <main className="container mx-auto px-4 py-16 max-w-4xl pb-32">
        <div className="text-left">
          <div className="mb-12">
            <ProgressIndicator currentStep={currentStep} totalSteps={5} />
          </div>

          {currentStep === 1 && (
            <>
              {/* Building icon */}
              <div className="mb-8">
                <Building2 className="w-16 h-16 text-gray-900" strokeWidth={1.5} />
              </div>

              {/* Main heading */}
              <h1 className="text-3xl font-bold text-gray-900 mb-6 leading-tight">What project have you realised?</h1>

              {/* Form */}
              <div className="space-y-8">
                {/* Category */}
                <div>
                  <label className="block text-base font-medium text-gray-900 mb-3">
                    What is the category of your project? <span className="text-red-500">*</span>
                  </label>
                  <CustomDropdown
                    field="category"
                    placeholder="Select a category"
                    value={formData.category}
                    options={dropdownOptions.category}
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    Choose the main category that best describes your project
                  </p>
                </div>

                {/* Project Type */}
                <div>
                  <label className="block text-base font-medium text-gray-900 mb-3">
                    Project type <span className="text-red-500">*</span>
                  </label>
                  <CustomDropdown
                    field="projectType"
                    placeholder="Select a project type"
                    value={formData.projectType}
                    options={dropdownOptions.projectType}
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    Specify whether this is a new build, renovation, or other type of project
                  </p>
                </div>

                {/* Building Type */}
                <div>
                  <label className="block text-base font-medium text-gray-900 mb-3">
                    Building type <span className="text-red-500">*</span>
                  </label>
                  <CustomDropdown
                    field="buildingType"
                    placeholder="Select a building type"
                    value={formData.buildingType}
                    options={dropdownOptions.buildingType}
                  />
                  <p className="text-sm text-gray-500 mt-2">Select the specific type of building or structure</p>
                </div>

                {/* Project Style */}
                <div>
                  <label className="block text-base font-medium text-gray-900 mb-3">
                    Project style <span className="text-red-500">*</span>
                  </label>
                  <CustomDropdown
                    field="projectStyle"
                    placeholder="Select a project style"
                    value={formData.projectStyle}
                    options={dropdownOptions.projectStyle}
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    Choose the architectural or design style that best represents your project
                  </p>
                </div>
              </div>
            </>
          )}

          {currentStep === 2 && (
            <>
              {/* Main heading */}
              <h1 className="text-3xl font-bold text-gray-900 mb-12 leading-tight">
                Describe the location and materials used
              </h1>

              {/* Form */}
              <div className="space-y-12">
                {/* Location Features */}
                <CheckboxGrid
                  title="Location features"
                  items={locationFeaturesData}
                  selectedValues={formData.locationFeatures}
                  onChange={(value) => handleCheckboxChange("locationFeatures", value)}
                />

                {/* Material Features */}
                <CheckboxGrid
                  title="Material features"
                  items={materialFeaturesData}
                  selectedValues={formData.materialFeatures}
                  onChange={(value) => handleCheckboxChange("materialFeatures", value)}
                />
              </div>
            </>
          )}

          {currentStep === 3 && (
            <>
              {/* Main heading */}
              <h1 className="text-3xl font-bold text-gray-900 mb-12 leading-tight">Add some details</h1>

              {/* Form */}
              <div className="space-y-8">
                {/* Size */}
                <div>
                  <label className="block text-base font-medium text-gray-900 mb-3">
                    Size <span className="text-red-500">*</span>
                  </label>
                  <CustomDropdown
                    field="size"
                    placeholder="Select size"
                    value={formData.size}
                    options={dropdownOptions.size}
                  />
                  <p className="text-sm text-gray-500 mt-2">Choose the overall size category of your project</p>
                </div>

                {/* Budget */}
                <div>
                  <label className="block text-base font-medium text-gray-900 mb-3">
                    Budget <span className="text-red-500">*</span>
                  </label>
                  <CustomDropdown
                    field="budget"
                    placeholder="Select budget range"
                    value={formData.budget}
                    options={dropdownOptions.budget}
                  />
                  <p className="text-sm text-gray-500 mt-2">Select your project budget range</p>
                </div>

                {/* Year built */}
                <div>
                  <label className="block text-base font-medium text-gray-900 mb-3">
                    Year built <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.yearBuilt}
                    onChange={(e) => handleInputChange("yearBuilt", e.target.value)}
                    placeholder="2022"
                    min="1800"
                    max={new Date().getFullYear()}
                    className="w-full px-4 py-3 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent hover:border-gray-400 transition-colors"
                  />
                  <p className="text-sm text-gray-500 mt-2">Enter the year when construction was completed</p>
                </div>

                {/* Building year */}
                <div>
                  <label className="block text-base font-medium text-gray-900 mb-3">
                    Building year <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.buildingYear}
                    onChange={(e) => handleInputChange("buildingYear", e.target.value)}
                    placeholder="1930"
                    min="1800"
                    max={new Date().getFullYear()}
                    className="w-full px-4 py-3 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent hover:border-gray-400 transition-colors"
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    Enter the original construction year if different from completion
                  </p>
                </div>
              </div>
            </>
          )}

          {currentStep === 4 && (
            <>
              {/* Main heading */}
              <h1 className="text-3xl font-bold text-gray-900 mb-12 leading-tight">
                Give your project a title and description
              </h1>

              {/* Form */}
              <div className="space-y-8">
                {/* Project Title */}
                <div>
                  <label className="block text-base font-medium text-gray-900 mb-3">
                    Project title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.projectTitle}
                    onChange={(e) => handleInputChange("projectTitle", e.target.value)}
                    placeholder="Project title"
                    className="w-full px-4 py-3 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent hover:border-gray-400 transition-colors"
                  />
                  <p className="text-sm text-gray-500 mt-2">Give your project a memorable and descriptive title</p>
                </div>

                {/* Project Description */}
                <div>
                  <label className="block text-base font-medium text-gray-900 mb-3">
                    Project description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.projectDescription}
                    onChange={(e) => handleInputChange("projectDescription", e.target.value)}
                    placeholder="Give the project description"
                    rows={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent hover:border-gray-400 transition-colors resize-vertical"
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    Provide a detailed description of your project, including key features and design elements
                  </p>
                </div>
              </div>
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
                  <div className="w-full h-96 bg-gray-100 rounded-lg overflow-hidden relative">
                    {/* Map placeholder with embedded Google Maps */}
                    <iframe
                      src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d387191.33750346623!2d-73.97968099999999!3d40.6974881!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c24fa5d33f083b%3A0xc80b8f06e177fe62!2sNew%20York%2C%20NY%2C%20USA!5e0!3m2!1sen!2sus!4v1703123456789!5m2!1sen!2sus"
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      className="absolute inset-0"
                    />

                    {/* Address search input overlay */}
                    <div className="absolute top-4 left-4 right-4 z-10">
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => handleInputChange("address", e.target.value)}
                        placeholder="Enter your address"
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent hover:border-gray-400 transition-colors"
                      />
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Search for your project location or click on the map to select it
                  </p>
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
                    onClick={() => handleToggleChange("shareExactLocation", !formData.shareExactLocation)}
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
          <div className="flex gap-4">
            <button
              onClick={handleBack}
              className="flex-1 bg-white text-gray-900 py-3 px-6 rounded-md font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleNext}
              disabled={
                (currentStep === 1 &&
                  (!formData.category || !formData.projectType || !formData.buildingType || !formData.projectStyle)) ||
                (currentStep === 2 &&
                  (formData.locationFeatures.length === 0 || formData.materialFeatures.length === 0)) ||
                (currentStep === 3 &&
                  (!formData.size || !formData.budget || !formData.yearBuilt || !formData.buildingYear)) ||
                (currentStep === 4 && (!formData.projectTitle || !formData.projectDescription)) ||
                (currentStep === 5 && !formData.address)
              }
              className="flex-1 bg-gray-900 text-white py-3 px-6 rounded-md font-medium hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {currentStep === 5 ? "Complete" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProgressIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="w-full">
      {/* Step counter */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-900">
          Step {currentStep} of {totalSteps}
        </span>
        <span className="text-sm text-gray-500">{Math.round((currentStep / totalSteps) * 100)}% complete</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-gray-900 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        />
      </div>
    </div>
  )
}

function NewProjectHeader() {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo on the left */}
          <div className="flex-shrink-0">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/design-mode-images/Arco%20Logo%20Large%20%281%29-aJeGJEgxeyF8NSayjRepsrq6ZTfTth.svg"
              alt="Arco"
              className="h-6"
            />
          </div>

          {/* Right side navigation */}
          <div className="flex items-center space-x-4">
            {/* Questions link */}
            <a
              href="/help-center"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              Questions?
            </a>

            {/* Save and Exit button */}
            <button className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              Save and Exit
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
