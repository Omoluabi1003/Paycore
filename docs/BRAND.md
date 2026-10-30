# PayCore sculptural identity

The approved direction is the photoreal, sculpted teal-and-titanium P with a luminous sage core, pearl-and-teal lettering and a midnight studio setting. The earlier shield/gold badge concepts are not used. The original generated masters remain outside the checkout; only the approved direction and its coordinated derivatives are included here.

The core represents the individual contractor and the specialist's human judgment. The connected surfaces represent exact calculations, configured obligations and an explainable settlement. The material depth conveys careful engineering. These are brand meanings, not claims of banking certification or automatic financial approval. ETL GIS Consulting LLC remains visibly credited.

## Assets and uses

| Asset | Use |
| --- | --- |
| `public/brand/paycore-hero-3d.png` | Landscape desktop splash and social hero |
| `public/brand/paycore-splash-mobile.png` | Full-height portrait mobile splash |
| `public/brand/paycore-logo-3d.png` | Transparent dimensional wordmark |
| `public/brand/paycore-symbol-3d.png` | Compact sculptural P for icons and documents |
| `/icon` | Generated 64×64 transparent browser icon |
| `/apple-icon` | Generated 180×180 touch icon on midnight navy |
| `/opengraph-image` | Generated 1200×630 sharing card |
| `/brand` | Public asset downloads and sharing controls |
| `/paycore-mark.svg` | Compatible legacy URL containing the approved symbol |

`BrandLogo` is shared by the workspace, access screen, document previews, mobile menu and scan headers. The sign-in emblem uses the same compact symbol. Next Image provides appropriately sized web delivery; source PNG masters are retained for downloads. The legacy flat PDF mark is replaced with the approved symbol, embedded once per document as RGB plus an alpha soft mask. Existing statement, invoice, report and sample-export calculations and layouts remain intact.

The splash uses a full-screen studio scene with the complete sculptural crest and dimensional PayCore wordmark visible. Landscape displays use the approved original `paycore-hero-3d.png`; portrait displays use `paycore-splash-mobile.png`, an image-tool extension of that scene with more studio wall and floor above/below the complete brand group. A picture source selects by viewport orientation. Both fill the viewport without stretching. Portrait cover crops only the surrounding studio at the tested phone/tablet ratios rather than zooming into the landscape lettering. Live tagline and attribution remain readable over a bottom gradient. Dynamic viewport units track mobile browser chrome. The seven-second intro behavior and original social sharing artwork are unchanged.

## Seven-second introduction

`BrandIntro` displays the splash for 7,000 milliseconds only on the first root (`/`) entry in the current tab session. A presentation-only sessionStorage flag is recorded when entry begins, including when the user skips. Direct links to Scan, the inbox, branding or other task routes open without the timed overlay. Background controls are inert while it is visible. Skip introduction allows deliberate early dismissal. With tab storage available, it does not restart on navigation, returning to the workspace or refreshing within the same tab session. If storage is blocked, task routes still bypass the intro and a document-local guard prevents client-navigation repeats; a fresh home document cannot retain that fallback state. This flag is not authentication. The mobile Scan links use Next navigation rather than forcing a document reload. Reduced-motion users see the same static seven-second introduction without the animated progress line. The permanent `/welcome` preview remains available after the opening introduction.

## Sharing

The current temporary hosting address is https://paycore-1.vercel.app/. It is not a permanent brand domain. Set `NEXT_PUBLIC_PAYCORE_URL` in Vercel to the future HTTPS public domain, then rebuild/redeploy; both sharing and canonical/social metadata use that setting. Configure the domain and TLS in Vercel before switching. When unset, the current hosting address is used as a fallback. Credentials are rejected; paths, queries and fragments are stripped. `lib/brand-identity.ts` defines the canonical destination used by metadata and sharing controls. Preview deployment URLs, selected payroll records, profile values, paths and query strings never enter the shared payload.

Share PayCore uses native sharing when available. Unsupported or failed sharing falls back to clipboard copy; cancelling native sharing leaves the clipboard alone. The interface shows one quiet Share PayCore action, without a persistent URL, Copy link or Open PayCore button. Denied/unavailable clipboard access reveals the current app link only for manual copying and never reports a false success. Open Graph and Twitter metadata use the same sculptural sharing image, title, description and developer attribution. The brand page has its own canonical path.

The live destination was reachable during development. New artwork and metadata require this branch to be merged and deployed before they appear publicly. Messaging platforms may cache previews; after deployment, refresh their preview cache or request a new scrape when available. Do not claim a cached old card means the deployment failed.

## Regeneration, validation and rollback

Run `node scripts/generate-brand-pdf.mjs` after an approved symbol change to rebuild the print encoding and compatible public SVG. This only encodes/resizes the approved art for delivery; it does not redesign the image. Commit the source artwork and generated derivatives together. PNG source transparency is retained, including in PDFs.

Run `pnpm test`, `pnpm typecheck` and `pnpm build`. PDF regressions check the approved image/soft-mask resources and object offsets while rejecting user-supplied replacement logos. Sharing regressions cover native success, cancellation, fallback, denied permissions and the public-only payload. Browser validation covers the seven-second duration, skip control, small screens, share metadata, native/clipboard flows and the existing payroll walkthrough. Retained browser scripts live outside repository dependencies in `/workspace/.tools`.

Rollback by reverting the branding commit and deploying the previous main version. No database, business-rule, payroll state or payment changes are included. No PR merge or production deployment is performed automatically.
