export default function ScanLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <><a className="skip-link" href="#scan-main-content">Skip to content</a>{children}</>;
}
