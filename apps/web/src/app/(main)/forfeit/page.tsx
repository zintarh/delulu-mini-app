"use client";

import { ForfeitCreatePage } from "@/components/forfeit/forfeit-create-page";
import { MainPage } from "@/components/main-app-header";

export default function ForfeitPage() {
  return (
    <MainPage className="flex h-full min-h-0 flex-col overflow-hidden">
      <ForfeitCreatePage />
    </MainPage>
  );
}
