"use client";
import MailboxWorkspace from "./mailbox-workspace";
export default function DocumentRegister({
  exceptions = false,
}: {
  exceptions?: boolean;
}) {
  return (
    <MailboxWorkspace compact view={exceptions ? "exceptions" : "activity"} />
  );
}
