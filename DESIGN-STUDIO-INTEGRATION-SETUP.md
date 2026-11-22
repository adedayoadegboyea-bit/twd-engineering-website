# TW&D Design Studio — integration setup

This guide covers the remaining account-side configuration for the integrated Design Studio.

## Flutterwave (test mode first)

The website now calls two Supabase Edge Functions:

- Checkout: `https://dawrvqdrnunigmzehhim.supabase.co/functions/v1/flutterwave-checkout`
- Webhook: `https://dawrvqdrnunigmzehhim.supabase.co/functions/v1/flutterwave-webhook`

In Supabase Dashboard → Edge Functions → Secrets, add:

- `FLW_SECRET_KEY`: Flutterwave **test** secret key initially. Keep it server-side; never add it to website JavaScript.
- `FLW_WEBHOOK_HASH`: a long random webhook secret hash that you also enter in Flutterwave's webhook settings.

In Flutterwave Dashboard → Settings → Webhooks, set the webhook URL to the webhook endpoint above and set the exact same secret hash. Enable payment event notifications. The webhook verifies the signature and then independently verifies the transaction against the invoice reference, amount and NGN currency before marking the invoice paid.

After test payments pass, replace the test secret with the live secret and perform a low-value live verification. Do not use live keys until test mode is confirmed.

## Issuing a design invoice

1. Sign in with an account assigned TW&D administrator or BOQ-staff access.
2. Open Design Studio. The administration section appears only to those roles.
3. Select a saved design project, enter the agreed professional/design fee and purpose, then issue the invoice.
4. The client signs in to their own account, sees the invoice and selects Pay with Flutterwave.
5. The payment callback and webhook both verify the payment server-side. The browser redirect alone never marks an invoice paid.

No design fee has been assumed or preloaded. TW&D must approve the fee for each invoice.

## Material pricing

- TW&D administrators/BOQ staff can add administered catalogue rates, set location and validity, and deactivate old prices.
- Suppliers sign in and submit a quotation with supplier identity, unit, rate, location and supporting evidence.
- Submitted supplier prices remain pending until a TW&D administrator/BOQ staff member approves them.
- Approval copies the quote into the active catalogue as a supplier-sourced price. Clients can then select current approved rates for estimates.
- Confirm actual availability and delivery cost with the supplier before issuing a contract quotation.

## ProtaStructure workstation and licence

The current website does not run ProtaStructure inside a browser. The intended integration is a controlled engineering workstation workflow using model exchange formats supported by ProtaStructure, especially IFC 2x3 and DXF. A structural engineer must import, check, analyse, design and approve the model in ProtaStructure before approved outputs are returned to the website.

Before this integration can be completed, TW&D needs:

1. A ProtaStructure Suite licence or trial issued by Prota Software/authorised reseller.
2. A dedicated Windows 10/11 64-bit workstation. Prota's published requirements specify a dedicated graphics card; recommended hardware includes 16 GB or more RAM and a dedicated GPU with 4 GB VRAM.
3. The ProtaStructure version, selected design-code settings, and a named structural engineer responsible for checking and approving the model.
4. A sample IFC/DXF model and a sample ProtaStructure output from the licensed workstation so the import/export hand-off can be validated.

Prota's official support documentation describes IFC 2x3 Coordination View import and IFC/DXF model exchange. We will not claim direct API automation until Prota confirms an approved automation/API route for the licensed version.

## Current limitations

The present 3D preview and footprint export are conceptual only. They are not coordinated architectural CAD drawings, structural calculations, approved construction documents or a certified BOQ. Those capabilities require the full drawing/BIM generation engine and professional engineering review.
