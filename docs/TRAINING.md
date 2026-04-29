# Training script — 30-min call with Matt

Use this as the running order for the recorded handover call. Total target: 30 min including questions.

## 0 · Setup (do before the call starts)

- [ ] Open the live admin URL, logged in as the real admin account.
- [ ] Open the worker app on a phone (real device, not emulator) — also signed in.
- [ ] Have a fresh Excel ready (e.g. a small test map with 3-4 stores).
- [ ] Quit Slack / email / anything that might ping during the recording.
- [ ] Start screen recording (Loom is easy; OBS for higher quality).

## 1 · Opening (1 min)

> "Hi Matt — this is the handover call for the Map Store rebuild. I'll record it so you can come back to any part later. We'll cover roughly: how to log in, how to upload a map, how to manage your team, what your workers see in the app, and the daily payroll export. About 30 minutes; ask anything as I go."

## 2 · Login + sidebar tour (2 min)

- Sign in. Show the role-aware sidebar.
- "These nav items change depending on whether you log in as admin, vendor, or viewer. As admin you see everything; vendors only see Maps + Profile."

## 3 · Map import (5 min)

- Click **+ Create map**.
- Drop in the test Excel.
- Show the map detail page that appears.
- Walk through the stores table: marker colour, per-task status, the **Property** column (upload a quick image to one row), the **View** column (will fill in once a worker completes a store).

> "The columns Map Store reads from your Excel are: Store #, Store Name, State, Address, Zip, Latitude, Longitude, Type, Manager, Regional, Notes — case-insensitive. Anything ending in 'Task' becomes a per-store task. Anything else numeric becomes a count column the worker fills in. We import your existing Lawn 2026 and Dilbeck spreadsheets directly — no reformatting."

## 4 · Workers + Vendors + Viewers (4 min)

- **Workers** page → add a real worker → show the one-time password copy.
- **Vendors** page → same pattern.
- **Viewers** page → quick "this is a lighter read-only role for stakeholders".
- Show **Reset password** + **Block / Unblock**.

> "If a worker forgets their password, you can reset it here, OR they can use the 'Forgot password?' link on the login page and the system emails them a reset link automatically. The legacy app didn't actually have a working password reset — this fixes that."

## 5 · Map assignment (3 min)

- Back to the map detail page.
- Click **Manage workers** → add the worker you just created.
- Click **Manage vendors** → add a vendor → "this is the fix for the bug you mentioned where vendors used to see every map. Now they only see what you put here."

## 6 · Tag-alert recipients (1 min)

- Click **Tag-alert recipients** → add an email address.

> "Whenever a worker raises a tag alert on this map (a trouble spot at a store), this list of emails gets the notification with the photos and comments. Set this up before sending workers out so you don't lose alerts."

## 7 · Worker mobile flow (8 min)

- Switch to the phone screen-cast.
- Sign in as the worker.
- Open the assigned map → show the colour-coded markers.
- Tap a store → show the detail card.
- Press **Continue** → AddPhotos screen.
- Take a Before photo. Show the **Save** button: "Press this if you're stepping away — your photo stays on the server and the marker stays blue. When you come back, you'll see it."
- Take an After photo.
- Press **Save & Next** → CheckSign.
- First / Last name + comments + signature → **Complete**.
- Switch back to the admin web and refresh the map detail. Show the marker turning red and the **View** link appearing.

## 8 · Excel download — the payroll part (3 min)

- Click **Download Excel**.
- Open the file. Walk through the columns:
  - Original Excel columns (Store #, Name, address, lat/lon, etc.)
  - Each task's status (e.g. Outside_Paint_Task = scheduled_or_complete)
  - Each count column with the actual number the worker entered
  - **Completed_At_UTC** + **Completed_At_Local** (worker's timezone — fixes the 'military time PM' bug from the legacy app)
  - **Completed_By** name + email
  - **General_Comments** (the comments the worker typed on the sign screen — the legacy export was missing this)
  - **Signature_URL** (clickable)
  - **Before_Photo_URLs** + **After_Photo_URLs** (semicolon-separated, signed for 7 days)

> "This is what you take to do payroll. Counts + worker name + completion date + photos all in one row per store."

## 9 · Tag-alert log + audit log (2 min)

- Show **Tag-alert log** on a map.
- Show **Audit log** in the sidebar — "for the 'who changed what' question."

## 10 · Wrap-up (2 min)

- Quick summary of what's where + the docs.
- Mention the 14-day bug-fix window: "If anything breaks in the first two weeks, message me on Freelancer and I'll fix it. After that, new feature requests would go through a Phase-4 contract."
- Stop recording.

## 11 · After the call

- Upload the recording somewhere private (Google Drive, Loom, Vimeo private).
- Send Matt the link + a short summary email.
- Send the final invoice on Freelancer.

## Optional: extra mini-trainings if Matt asks

- **"How do I set up a new spreadsheet?"** → walk through the column rules (above).
- **"What if the email goes to spam?"** → check Postmark's bounce/spam dashboard; verify the SPF/DKIM records.
- **"What happens if a worker loses signal?"** → photos are saved locally and uploaded automatically when they reconnect; signature is held on-device until they have signal.
