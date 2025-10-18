"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { useState } from "react"

interface ResetPassword1Props {
  heading?: string
  logo: {
    url: string
    src: string
    alt: string
    title?: string
  }
  buttonText?: string
  loginText?: string
  loginUrl?: string
  description?: string
}

const ResetPassword1 = ({
  heading = "Reset Password",
  logo = {
    url: "/",
    src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg",
    alt: "Arco Logo",
    title: "Arco",
  },
  buttonText = "Send Reset Link",
  loginText = "Remember your password?",
  loginUrl = "/login",
  description = "Enter your email address and we’ll send you a link to reset your password.",
}: ResetPassword1Props) => {
  const [email, setEmail] = useState("")
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle reset password logic here
    setIsSubmitted(true)
  }

  if (isSubmitted) {
    return (
      <section className="bg-muted h-screen">
        <div className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-6 lg:justify-start">
            <Link href={logo.url}>
              <img
                src={logo.src || "/placeholder.svg"}
                alt={logo.alt}
                title={logo.title}
                className="h-10 dark:invert"
              />
            </Link>
            <div className="min-w-sm border-muted bg-background flex w-full max-w-sm flex-col items-center gap-y-4 rounded-md border px-6 py-8 shadow-md text-center">
              <h1 className="text-xl font-semibold">Check Your Email</h1>
              <p className="text-muted-foreground text-sm">We’ve sent a password reset link to {email}</p>
              <Button asChild variant="secondary" className="w-full">
                <Link href={loginUrl}>Back to Login</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-muted h-screen">
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-6 lg:justify-start">
          <Link href={logo.url}>
            <img src={logo.src || "/placeholder.svg"} alt={logo.alt} title={logo.title} className="h-10 dark:invert" />
          </Link>
          <form
            onSubmit={handleSubmit}
            className="min-w-sm border-muted bg-background flex w-full max-w-sm flex-col items-center gap-y-4 rounded-md border px-6 py-8 shadow-md"
          >
            <h1 className="text-xl font-semibold">{heading}</h1>
            <p className="text-muted-foreground text-sm text-center">{description}</p>
            <Input
              type="email"
              placeholder="Email"
              className="text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" variant="secondary" className="w-full">
              {buttonText}
            </Button>
          </form>
          <div className="text-muted-foreground flex justify-center gap-1 text-sm">
            <p>{loginText}</p>
            <Link href={loginUrl} className="text-primary font-medium hover:underline">
              Login
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

export { ResetPassword1 }
