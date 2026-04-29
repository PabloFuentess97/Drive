"use client";

import { FileBrowser } from "@/components/FileBrowser";
import { VaultGate } from "@/components/VaultGate";

export default function SecureFolderPage({ params }: { params: { id: string } }) {
  return (
    <VaultGate>
      {({ lock }) => (
        <FileBrowser
          folderId={params.id}
          secure
          rootName="Carpeta segura"
          routePrefix="/secure"
          onLock={lock}
        />
      )}
    </VaultGate>
  );
}
