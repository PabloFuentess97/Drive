import { FileBrowser } from "@/components/FileBrowser";

export const metadata = { title: "Mi unidad" };

export default function DrivePage() {
  return <FileBrowser folderId={null} />;
}
