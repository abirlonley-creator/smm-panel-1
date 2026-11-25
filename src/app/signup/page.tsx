import { AuthSplitShell } from "@/components/auth/AuthSplitShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Account — AuraSMM",
  description:
    "Create your AuraSMM account. Start organic social pacing across TikTok, Instagram, YouTube, and X.",
};

export default function SignupPage() {
  return <AuthSplitShell initialMode="signup" />;
}
