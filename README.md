# Underwriting Deal Tracker

I built a web app for tracking real estate deals through the underwriting pipeline. I tried to make this as simple and easy to use as possible. It is very difficult to track all deal context on a tracker that pulls information from emails, messages, and phone calls. There are many tools being built today to capture all context so that teams can utilize all of the information. However, real estate teams sometimes just need a simple tracker that everyone can simultaneously update that is more streamlined than a Google Doc, or shared Excel sheet. Because Firestore's free tier includes 1 GB of storage, real estate teams will virtually never hit that limit — each deal is just a small JSON file.

## Tech Stack
- HTML / Bulma CSS / Vanilla JavaScript
- Firebase Firestore (database)
- Firebase Hosting

## Setup
1. Clone the repo
2. Add your Firebase config to `public/app.js`
3. Run `firebase deploy`
