import { FileBrowser } from "@/components/FileBrowser";

export const metadata = { title: "Carpeta" };

export default function FolderPage({ params }: { params: { id: string } }) {
  return <FileBrowser folderId={params.id} />;
}
