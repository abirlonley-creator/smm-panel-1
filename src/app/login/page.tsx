import { AuthSplitShell } from "@/components/auth/AuthSplitShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In — AuraSMM",
  description:
    "Sign in to your AuraSMM workspace. Manage campaigns, algorithmic pacing curves, and active orders.",
};

export default function LoginPage() {
  return <AuthSplitShell initialMode="signin" />;
}
