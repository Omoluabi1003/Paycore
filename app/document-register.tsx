"use client";
import GmailWorkspace from "./gmail-workspace";
export default function DocumentRegister({
  exceptions = false,
}: {
  exceptions?: boolean;
}) {
  return (
    <GmailWorkspace compact view={exceptions ? "exceptions" : "activity"} />
  );
}
