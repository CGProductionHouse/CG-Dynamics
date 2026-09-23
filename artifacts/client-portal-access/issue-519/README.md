# Issue #519 — active-client portal access reconciliation

Read-only production capture: 2026-09-23T19:48:00Z

- Active clients: 57
- Current service scope: 47 eligible / 10 excluded
- Preserve exact existing access: 37
- Link existing exact profile without creating a duplicate: 2
- New access through approved #399 flow: 7
- No client portal currently needed: 11
- Verified published reports across the fleet: 119
- Production writes: 0
- Credentials included: no

The smallest launch provisioning batch is 9 clients: 2 exact existing profiles to link and 7 new users through the existing approved #399 flow. That batch remains a protected production action and was not executed.

| Client | Scope | Mapping | Active profile | Published reports | Action |
|---|---|---:|---:|---:|---|
| Agri-Secure | excluded | 0 | 0 | 0 | no_client_portal_needed |
| All Around PVC | eligible | 0 | 0 | 1 | provision_new_under_approved_flow |
| AV Event Life | eligible | 1 | 1 | 3 | preserve |
| Bat Hill Royale | eligible | 0 | 0 | 2 | provision_new_under_approved_flow |
| Bloem Action Sports | eligible | 1 | 1 | 0 | preserve |
| Bloem Marble & Granite | eligible | 1 | 1 | 3 | preserve |
| Bloem Vascular | excluded | 0 | 0 | 0 | no_client_portal_needed |
| Bohemia Quick Stop | eligible | 1 | 1 | 3 | preserve |
| Bouwer & Coetzee Attorneys | eligible | 1 | 1 | 3 | preserve |
| Braize | eligible | 0 | 1 | 4 | provision_link_existing_profile |
| C&L Innovations | eligible | 1 | 1 | 3 | preserve |
| Cape Lumber | eligible | 1 | 1 | 5 | preserve |
| Case Bloemfontein | eligible | 0 | 0 | 3 | provision_new_under_approved_flow |
| Central Canvas | eligible | 1 | 1 | 3 | preserve |
| CG Production House | eligible | 0 | 1 | 5 | provision_link_existing_profile |
| Daisy & Co | eligible | 1 | 1 | 3 | preserve |
| Delta Gas | eligible | 1 | 1 | 3 | preserve |
| Dulux Paint & Paper Bloemfontein | eligible | 1 | 1 | 3 | preserve |
| Econofoods | excluded | 1 | 1 | 0 | preserve |
| Ehrlich Park Butchery | eligible | 1 | 1 | 3 | preserve |
| Emmanuel Funerals | eligible | 1 | 1 | 3 | preserve |
| Emoya Estate Driving Range | eligible | 0 | 0 | 0 | no_client_portal_needed |
| First Technology Central | excluded | 1 | 1 | 3 | preserve |
| Forklift Trucks | eligible | 0 | 0 | 0 | no_client_portal_needed |
| Germoparts | eligible | 1 | 1 | 3 | preserve |
| Hino Trucks | eligible | 1 | 1 | 0 | preserve |
| HMHI | eligible | 0 | 0 | 3 | provision_new_under_approved_flow |
| Human Auto | eligible | 0 | 0 | 0 | no_client_portal_needed |
| Ipopeng Office Supplies | excluded | 0 | 0 | 0 | no_client_portal_needed |
| Jenkor | eligible | 1 | 1 | 0 | preserve |
| Kundedienste | excluded | 1 | 1 | 0 | preserve |
| Local Deli | excluded | 1 | 1 | 1 | preserve |
| Loraclox | eligible | 1 | 1 | 3 | preserve |
| Madison Wear | eligible | 1 | 1 | 3 | preserve |
| Mimosa Mall | excluded | 0 | 0 | 0 | no_client_portal_needed |
| NCNA | excluded | 0 | 0 | 0 | no_client_portal_needed |
| Novus Steel | eligible | 1 | 1 | 3 | preserve |
| Peyper Bonds | eligible | 1 | 1 | 3 | preserve |
| Piek Group | eligible | 1 | 1 | 3 | preserve |
| PSG Bloemfontein | eligible | 1 | 1 | 3 | preserve |
| RC-Polypipe | eligible | 1 | 1 | 3 | preserve |
| Red Oak | eligible | 1 | 1 | 2 | preserve |
| Rusoord Farmstay | excluded | 0 | 0 | 0 | no_client_portal_needed |
| SecuriForce | eligible | 1 | 1 | 4 | preserve |
| Supa Quick BFN | eligible | 1 | 1 | 3 | preserve |
| Supa Quick Centurion | eligible | 1 | 1 | 3 | preserve |
| TBS Brokers | eligible | 1 | 1 | 3 | preserve |
| The Staffordshire | eligible | 0 | 0 | 3 | provision_new_under_approved_flow |
| Tobich Optics | eligible | 1 | 1 | 3 | preserve |
| Toyota Bloemfontein | eligible | 1 | 1 | 0 | preserve |
| Vrystaat Kunstefees | eligible | 0 | 0 | 2 | provision_new_under_approved_flow |
| Watch Addict | eligible | 1 | 1 | 3 | preserve |
| We Ar Fuels | eligible | 1 | 1 | 3 | preserve |
| Wiseman Group | eligible | 1 | 1 | 3 | preserve |
| WiseRide | eligible | 0 | 0 | 0 | no_client_portal_needed |
| Zooz Lifestyle WFF | eligible | 0 | 0 | 3 | provision_new_under_approved_flow |
| Neshora Oxygen | eligible | 0 | 0 | 0 | no_client_portal_needed |
