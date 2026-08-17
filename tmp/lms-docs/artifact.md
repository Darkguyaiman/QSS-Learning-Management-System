# Template execution contract

## Reference

- Retained DOCX: `C:\Users\Mohamed Aiman\Desktop\Quick Stop Solution LMS\Example\System Per Tab Explaination .docx`
- SHA-256: `88270f62762c4a7bffaa8ae44cd37c220c4b66b603152c43591d531f7b7106d9`
- Cached page count: 15 (`docProps/app.xml`)
- Section count: 1
- Evidence: `tmp/lms-docs/reference-docx-inspection.json`, `tmp/lms-docs/template-style-evidence.json`, `tmp/lms-docs/reference-unpacked/`
- Render note: the packaged renderer could not run because LibreOffice is not installed. Microsoft Word automation was also unavailable because the local Word process did not complete the headless export. Structural evidence and the source package are therefore the design authority.

## Page system

- US Letter portrait: 8.5 x 11 inches.
- Margins: 1 inch on all sides.
- Header distance: 0.5 inch. Footer distance: 0.5 inch.
- One section, no different first page, no odd/even split.
- Cover page followed by the guide body. Page breaks may be added between major sections when needed to avoid stranded headings.

## Typography and paragraph roles

- Primary typeface: Times New Roman throughout.
- Cover title: centered, 24 pt, bold.
- Cover subtitle: 14 pt, centered.
- Body: 11 pt, justified, approximately 1.15 line spacing and 10 pt after paragraphs, matching the source defaults.
- Main numbered module headings: Times New Roman, 14 pt, bold, kept with the following paragraph.
- Subheadings: Times New Roman, 11 pt, bold, kept with the following paragraph.
- Navigation tree: Times New Roman, 8.5 pt, 1 pt after; top-level entries bold.
- Numbered procedures use the source document's real `List Number` style; information lists use `List Bullet`.

## Lists and tables

- Tables use `Table Grid`, full usable width (6.5 inches / 9360 DXA), fixed geometry, repeating header rows, and no fixed row heights.
- Header cells are bold. Body text is 9 pt Times New Roman with comfortable cell margins.
- Three-column comparison tables use widths 1.55 / 3.40 / 1.55 inches unless content requires the access column to be wider.
- Two-column reference tables use widths 2.0 / 4.5 inches.

## Components

- The Quick Stop Solution logo from `word/media/image1.png` is retained as the cover identity.
- Cover: logo, system name, and `Tab Explanation and Step-by-Step User Guide` subtitle.
- Opening block: guide purpose, end-to-end system flow, navigation tree, navigation summary table, and role access table.
- Each module follows the source sequence: numbered module title, `Purpose`, `Information Displayed`, task-oriented `How To...` procedures, and control/logic notes where relevant.
- Footer text is updated to `Q-Learning Management System User Guide` and centered.

## Content flow and slot map

- Replace the credit-system title and all guide content with LMS-specific content.
- Preserve the cover identity pattern, page geometry, source styles, logo asset, table treatment, and footer placement.
- Replace the sidebar tree with the LMS navigation and its training-workspace tabs.
- Replace role/access rows with Admin, Trainer, and Trainee permissions.
- Replace the nine credit-system modules with LMS modules: Dashboard; Trainings; Training Workspace; Trainees; Question Bank; Tests; Attendance; Marks/Results/Certificates; Package; Settings; Profile/Registration; Controls and operating routine.
- Remove all credit-monitoring terminology. Do not retain unsupported finance, device-credit, or payment workflows.

## Package preservation

- Preserve-only: `[Content_Types].xml`, theme, styles, numbering, font table, settings, web settings, custom XML, document properties, and the original logo media part unless a relationship update is required.
- Editable: `word/document.xml`, footer text part, document relationships needed for the logo, and calculated document-property counts.
- No comments, footnotes, content controls, or tracked changes are present in the reference.

## Fidelity gates

- Retained reference must remain byte-for-byte unchanged.
- Final document must retain the same page size, margins, one-section structure, Times New Roman hierarchy, cover/logo pattern, table-grid styling, and centered footer pattern.
- Every navigation area and role must be represented, including role-sensitive training tabs.
- No clipping, broken tables, orphaned headings, placeholder text, or credit-system content may remain.
- Because LibreOffice is unavailable, use structural audits and PDF rendering through Microsoft Word if it becomes available; otherwise disclose the visual-render limitation.
