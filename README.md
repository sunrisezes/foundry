# Campus Lost & Found

A MERN application for reporting lost and found items, discovering visual matches, and coordinating claims.

## Requirements

- Node.js 20.13+
- MongoDB (local or hosted)

## Run locally

1. Copy `server/.env.example` to `server/.env` and set `MONGODB_URI` and a long random `JWT_SECRET`.
2. From the repository root, run `npm install`.
3. Run `npm run dev`. The Vite client is available at `http://localhost:5173` and the API at `http://localhost:5000`.

On startup, the server attempts to load the local Transformers.js CLIP model. If the weights cannot be downloaded, it logs the reason and uses its deterministic Sharp-based visual descriptor instead. No external paid API is used.

The API serves uploaded images from `/uploads`. Set `CLIENT_ORIGIN` when the client is hosted on another origin. Register an account to post items and submit claims. Administrator accounts must be assigned the `admin` role through a trusted database operation.

Removing a report hides it from public listings but retains its item document, image, deletion timestamp, and deleting user for the audit trail. Report owners can restore removed reports from **My reports**.

The **Contact us** form saves submissions in the `contactmessages` collection. Administrators can manage report statuses for all active reports at `/admin/reports` and review contact submissions at `/admin/contact`. Only administrators can manually change report status; completing a verified handover still resolves its item automatically. The About, How it works, Privacy, and Terms pages are available from the footer and the mobile navigation menu. Review the policy text in `client/src/App.jsx` for institution-specific requirements before deployment.
