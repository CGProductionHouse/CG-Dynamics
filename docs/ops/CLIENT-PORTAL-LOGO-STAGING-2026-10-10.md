# Private client-portal logo staging — 10 October 2026

CA asked CG to reuse each exact client's existing internal logo in the private OneDrive client portal. This is an asset-staging receipt, **not** Dynamics Brand Hub publication or proof that every brand variant is current.

## Verified result

- All 61 exact `A_ClientPortal_*` roots and their Brand Identity categories were read before copying; all 61 Brand Identity folders were empty.
- 44 selected logo image/PDF files were copied into the matching exact client Brand Identity folders, covering 43 clients. JFJ Electrical has both existing digital light and dark variants.
- Each destination was read back with its expected filename, size and source file hash. All 44 copied files had zero anonymous permissions and owner-only effective permission on readback. A final read of all 61 portal roots found zero anonymous links and zero permission-read errors.
- The copies total 30,928,473 bytes (29.5 MiB). A physical OneDrive copy is **not** zero-space; a shortcut/reference to internal source folders would risk crossing the client-safe boundary, so no internal folder was shared or linked.
- No original was moved or deleted. No named-client share, Dynamics library/category/asset mapping, resolver activation, production SQL, Edge or Vercel action occurred. The files remain private and should be reviewed with the client-safe brand pack before release.

## Exact staged files

| Exact internal client folder | Copied filename |
| --- | --- |
| All Around PVC | All Around PVC.png |
| AV Event Life | Logo.png |
| Bloem Action Sports | Bloem Action Sport.png |
| BloemVascular | BLOEM VASCULAR.png |
| Bouwer Coetzee | TRANS.png |
| Braize | BRAIZE_01.png |
| C&L Innovations | C&L INNOVATIONS.png |
| Cape Lumber | Cape Lumber.png |
| Case | Case Bloem logo.pdf |
| Central Canvas | Final Color.png |
| Delta Gas | Delta Gas.png |
| Ehlrich Park Slaghuis | Ehrlich park slaghuis.png |
| Elcheck | Elcheck.png |
| Emmanuel Funerals | Emmanuel Funerals.png |
| Emoya Driving Range | Emoya Driving Range logo V2.pdf |
| First Technology | First Tech.png |
| Germoparts | GERMOPARTS logo_full.pdf |
| HMHI Attorneys | HMH-Logo.png |
| Human Auto | HUMAN AUTO.png |
| Jenkor | Logo T.png |
| JFJ Electrical | jfj-logo-digital-dark.png |
| JFJ Electrical | jfj-logo-digital-light.png |
| Kundendienst | LOGO.png |
| LHP Student Village & Block | LHP Student Village - logo.png |
| Local Meat Deli | TRANS.png |
| Loraclox | LOGO TRANS.png |
| Madisons | MADISONS.png |
| NCNA | Logo.png |
| Neshora Oxygen | Logo.png |
| Novus Steel | logo.png |
| Peyper Bonds | PEYPER BONDS.png |
| Piek Group | PIEK GROUP OF COMPANIES.png |
| PSG | PSG-Logo.png |
| Securiforce | LOGO TRANS.png |
| Supa Quick BFN | supa-quick-logo.png |
| Supa Quick Centurion | supa-quick-logo.png |
| The Staffy | LOGO_BG.png |
| Tobich Optics | Tobich optics.png |
| Toyota | Toyota.png |
| VCS Vasilis Cleaning Solutions | VCS Logo-01.png |
| Watch addict | Watch Addict.png |
| We Ar Fuels | Logo No Background.png |
| Wiseman Group | WISEMAN GROUP LOGO.png |
| WiseRide | RED & BLACK.png |

VCS's selected PNG came from its own client-received VCS logo folder. WiseRide's selected PNG came from the exact WiseRide brand folder nested under Wiseman Group. Both Supa Quick branch logos came from the existing Supa Quick branding folder under Wiseman Group. These are source-location facts, not permission to expose the group parent.

## Still empty: source or version decision needed

Agri-Secure, Bat Hill Royale, Bloem Marble, Bohemia Quick Stop, CG Production House, Daizy & Co, Dulux Paint Bloemfontein, ECONO, Forklift Trucks OFS, Hino, Ipopeng Office Supplies, Mimosa, RC Polypipe, Red Oak, Rusoord Farmstay, TBS Brokers, Vrystaat Kunstefees, Zooz Lifestyle.

These 18 have no unambiguous current image/PDF logo in their own internal Brand Identity area, or have several competing/partial/branch-specific variants. Do not substitute another client's logo, infer a current mark from marketing artwork, or create a public OneDrive shortcut. Resolve each against the existing approved brand source before staging. Even staged logos need client-role isolation and the separate #396 Brand Hub mapping/enablement gate before a client sees them.
