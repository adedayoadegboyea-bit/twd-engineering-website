# TW&D Marketplace

This module adds a marketplace where visitors can browse listings and submit houses, land, cars, home gadgets, building materials and equipment for review.

## Backend setup
1. Create a Google Apps Script project.
2. Paste `Code.gs`.
3. Run `testSetup()` once and authorize Google Drive, Sheets and Mail.
4. Deploy as **Web app**, executing as the owner, with access set to **Anyone**.
5. Copy the Web App URL.
6. Put that URL into `marketplace.js` in place of `PASTE_YOUR_MARKETPLACE_WEB_APP_URL_HERE`.
7. Commit and test a small image listing.

## Moderation
New listings are written to the Google Sheet with status `PENDING_REVIEW`. The administrator should review the seller, item and images before publishing a listing to the public marketplace feed.

## Subscriptions / monetization
The public page includes Starter, Business and Pro seller plans. Live recurring payments require a merchant account with a payment processor such as Paystack or Flutterwave. Do not put secret API keys in this GitHub repository or in browser JavaScript. The eventual architecture should be:
browser -> payment provider checkout -> secure webhook/backend -> subscription status in Sheets/database -> seller listing limits.

## Important
The static GitHub Pages site is not itself a secure marketplace backend. The Apps Script backend stores submitted photos in Drive and metadata in Sheets. For production scale, a proper database, object storage, authenticated seller accounts, moderation dashboard and payment webhook should replace or augment Apps Script.