"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload } from "lucide-react"
import Image from "next/image"

export default function CreateCompanyPage() {
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState("")
  const [domain, setDomain] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [primaryService, setPrimaryService] = useState("")

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle form submission
    console.log("[v0] Form submitted:", {
      companyName,
      domain,
      email,
      phone,
      primaryService,
    })
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8">
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg"
            alt="Arco Logo"
            width={48}
            height={48}
            className="w-auto h-6"
          />
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Create a company</h1>
          <p className="text-sm text-gray-500">Description</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Logo Upload */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                {logoPreview ? (
                  <img
                    src={logoPreview || "/placeholder.svg"}
                    alt="Company logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Upload className="w-8 h-8 text-gray-400" />
                )}
              </div>
            </div>
            <label htmlFor="logo-upload">
              <Button type="button" variant="outline" size="sm" className="cursor-pointer bg-transparent" asChild>
                <span>Change logo</span>
              </Button>
              <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </label>
          </div>

          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="company-name" className="text-sm font-medium text-gray-900">
              Company name
            </Label>
            <Input
              id="company-name"
              placeholder="Company name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full"
            />
            <p className="text-xs text-gray-500">Helper</p>
          </div>

          {/* Domain */}
          <div className="space-y-2">
            <Label htmlFor="domain" className="text-sm font-medium text-gray-900">
              Domain
            </Label>
            <Input
              id="domain"
              placeholder="Website"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="w-full"
            />
            <p className="text-xs text-gray-500">Your domain need to be the same as your account email address</p>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-gray-900">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full"
            />
            <p className="text-xs text-gray-500">This email will be listed on your company page</p>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium text-gray-900">
              Phone
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder=""
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full"
            />
            <p className="text-xs text-gray-500">This phone number will be visible on your company page</p>
          </div>

          {/* Primary Service */}
          <div className="space-y-2">
            <Label htmlFor="primary-service" className="text-sm font-medium text-gray-900">
              Primary service
            </Label>
            <Select value={primaryService} onValueChange={setPrimaryService}>
              <SelectTrigger id="primary-service" className="w-full">
                <SelectValue placeholder="Select company services" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="architecture">Architecture</SelectItem>
                <SelectItem value="interior-design">Interior Design</SelectItem>
                <SelectItem value="construction">Construction</SelectItem>
                <SelectItem value="landscaping">Landscaping</SelectItem>
                <SelectItem value="renovation">Renovation</SelectItem>
                <SelectItem value="consulting">Consulting</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">Additional services can be added later</p>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <Button type="submit" className="bg-black text-white hover:bg-gray-800 px-8">
              Next
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
