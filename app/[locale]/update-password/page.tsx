import type { Metadata } from "next"
import { UpdatePassword } from "@/components/update-password"

export const metadata: Metadata = {
  title: "Update Password",
  description: "Set your new Arco account password.",
}

export default function UpdatePasswordPage() {
  return <UpdatePassword />
}
