import { FileBrowser } from "@/components/FileBrowser";

export const metadata = { title: "Folder" };

export default function FolderPage({ params }: { params: { id: string } }) {
  return <FileBrowser folderId={params.id} />;
}
