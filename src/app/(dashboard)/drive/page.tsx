import { FileBrowser } from "@/components/FileBrowser";

export const metadata = { title: "My Drive" };

export default function DrivePage() {
  return <FileBrowser folderId={null} />;
}
