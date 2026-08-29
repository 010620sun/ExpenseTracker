import { redirect } from "next/navigation";

import { pageMetadata } from "@/lib/page-metadata";
import { requestLanguage } from "@/lib/request-language";

import { getCurrentMember } from "../member-auth";
import { GuideContent } from "./guide-content";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return pageMetadata("guide", await requestLanguage());
}

export default async function GuidePage() {
  const [member, initialLanguage] = await Promise.all([
    getCurrentMember(),
    requestLanguage(),
  ]);
  if (!member) redirect("/auth?return_to=/guide");

  return <GuideContent initialLanguage={initialLanguage} />;
}
