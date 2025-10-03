"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import { DashboardHeader } from "@/components/dashboard-header";
import { Footer } from "@/components/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";

export default function PricingPage() {
  const [isAnnually, setIsAnnually] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <DashboardHeader />

      <main className="flex-1 py-8">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <h1 className="mb-6 text-2xl font-semibold text-gray-900">Pricing</h1>

          <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <p className="text-muted-foreground max-w-3xl">
              Lorem ipsum dolor sit amet, consectetur adipisicing elit. Fugiat
              odio, expedita neque ipsum pariatur suscipit!
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <span className="text-sm text-red-500 font-medium whitespace-nowrap">
                Save up to 20% with yearly
              </span>
              <div className="bg-muted flex h-11 w-fit shrink-0 items-center rounded-md p-1 text-lg">
                <RadioGroup
                  defaultValue="monthly"
                  className="h-full grid-cols-2"
                  onValueChange={(value) => {
                    setIsAnnually(value === "annually");
                  }}
                >
                  <div className='has-[button[data-state="checked"]]:bg-background h-full rounded-md transition-all'>
                    <RadioGroupItem
                      value="monthly"
                      id="monthly"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="monthly"
                      className="text-muted-foreground peer-data-[state=checked]:text-primary flex h-full cursor-pointer items-center justify-center px-7 font-semibold"
                    >
                      Monthly
                    </Label>
                  </div>
                  <div className='has-[button[data-state="checked"]]:bg-background h-full rounded-md transition-all'>
                    <RadioGroupItem
                      value="annually"
                      id="annually"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="annually"
                      className="text-muted-foreground peer-data-[state=checked]:text-primary flex h-full cursor-pointer items-center justify-center gap-1 px-7 font-semibold"
                    >
                      Yearly
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col items-stretch gap-6 md:flex-row">
            <div className="flex w-full flex-col rounded-lg border bg-white p-6 text-left">
              <Badge className="mb-6 block w-fit">BASIC</Badge>
              <span className="text-4xl font-medium">$0</span>
              <p className="text-muted-foreground invisible">Per month</p>
              <Separator className="my-6" />
              <div className="flex flex-1 flex-col justify-between gap-6">
                <ul className="text-muted-foreground space-y-4">
                  <li className="flex items-center gap-2">
                    <Check className="size-4" />
                    <span>Up to 3 projects</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4" />
                    <span>Company page with project portfolio</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4" />
                    <span>Review collection</span>
                  </li>
                </ul>
                <Button variant="outline" className="w-full" disabled>
                  Active
                </Button>
              </div>
            </div>
            <div className="flex w-full flex-col rounded-lg border bg-white p-6 text-left">
              <Badge className="mb-6 block w-fit">PLUS</Badge>
              {isAnnually ? (
                <>
                  <div className="flex items-center gap-3">
                    <span className="text-4xl font-medium">€39</span>
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      20% off
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">Per year</p>
                </>
              ) : (
                <>
                  <span className="text-4xl font-medium">€39</span>
                  <p className="text-muted-foreground">Per month</p>
                </>
              )}
              <Separator className="my-6" />
              <div className="flex flex-1 flex-col justify-between gap-6">
                <ul className="text-muted-foreground space-y-4">
                  <li className="flex items-center gap-2">
                    <Check className="size-4" />
                    <span>Unlimited projects</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4" />
                    <span>Company page with unlimited projects</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4" />
                    <span>Review collection</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4" />
                    <span>Included in professional searches</span>
                  </li>
                </ul>
                <Button className="w-full bg-red-500 hover:bg-red-600 text-white">Upgrade</Button>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Billing</h2>
                <p className="mt-2 text-sm text-gray-900 font-medium">You are on a Basic plan</p>
                <p className="mt-1 text-sm text-gray-500">View and make changes to your plan.</p>
              </div>
              <Button variant="outline" className="w-full sm:w-auto">Manage subscription</Button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
