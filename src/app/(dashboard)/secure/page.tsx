"use client";

import { FileBrowser } from "@/components/FileBrowser";
import { VaultGate } from "@/components/VaultGate";

export default function SecureRootPage() {
  return (
    <VaultGate>
      {({ lock }) => (
        <FileBrowser
          folderId={null}
          secure
          rootName="Carpeta segura"
          routePrefix="/secure"
          onLock={lock}
        />
      )}
    </VaultGate>
  );
}
