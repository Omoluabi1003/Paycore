import Link from 'next/link';
import DocumentRegister from '../../document-register';
export default function DocumentActivityPage(){return <main id="scan-main-content" tabIndex={-1} className="document-page"><nav><Link href="/">Workspace</Link> · <Link href="/scan">Scan</Link> · <Link href="/scan/inbox">Document inbox</Link></nav><h1>Activity Register</h1><DocumentRegister/><footer>Developed by ETL GIS Consulting LLC</footer></main>}
