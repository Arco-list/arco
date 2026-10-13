import type { Metadata } from "next"

import { NO_INDEX } from "@/lib/seo-utils"
import { UpdatePassword } from "@/components/update-password"

export const metadata: Metadata = {
  title: "Update Password",
  description: "Set your new Arco account password.",
  robots: NO_INDEX,
}

export default function UpdatePasswordPage() {
  return <UpdatePassword />
}
